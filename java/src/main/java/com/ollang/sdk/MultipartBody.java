package com.ollang.sdk;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.SequenceInputStream;
import java.io.UncheckedIOException;
import java.net.http.HttpRequest;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Minimal builder for {@code multipart/form-data} request bodies.
 *
 * <p>File parts added from a {@link Path} are streamed from disk while the request is sent, so
 * large media files never have to fit in memory. The total {@code Content-Length} is still
 * computed up front, so the request is not chunked.
 */
public final class MultipartBody {

  private final String boundary = "ollang-" + UUID.randomUUID();
  private final List<Part> parts = new ArrayList<>();

  public MultipartBody addField(String name, String value) {
    parts.add(new BytesPart(ascii("--" + boundary + "\r\n")));
    parts.add(new BytesPart(ascii("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n")));
    parts.add(new BytesPart(value.getBytes(StandardCharsets.UTF_8)));
    parts.add(new BytesPart(ascii("\r\n")));
    return this;
  }

  /** Adds a file part from in-memory content. */
  public MultipartBody addFile(String fieldName, String filename, byte[] content, String contentType) {
    parts.add(new BytesPart(fileHeader(fieldName, filename, contentType)));
    parts.add(new BytesPart(content));
    parts.add(new BytesPart(ascii("\r\n")));
    return this;
  }

  /** Adds a file part that is streamed from disk when the request is sent. */
  public MultipartBody addFile(String fieldName, String filename, Path file, String contentType) {
    parts.add(new BytesPart(fileHeader(fieldName, filename, contentType)));
    parts.add(new FilePart(file));
    parts.add(new BytesPart(ascii("\r\n")));
    return this;
  }

  /** The value for the request's {@code Content-Type} header. */
  public String contentType() {
    return "multipart/form-data; boundary=" + boundary;
  }

  /** Total encoded length in bytes, including the closing boundary. */
  public long contentLength() {
    long total = 0;
    try {
      for (Part part : allParts()) {
        total += part.size();
      }
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    return total;
  }

  /** A streaming body publisher with a known {@code Content-Length}. */
  public HttpRequest.BodyPublisher bodyPublisher() {
    long length = contentLength();
    Supplier<InputStream> supplier = this::openStream;
    return HttpRequest.BodyPublishers.fromPublisher(
        HttpRequest.BodyPublishers.ofInputStream(supplier), length);
  }

  /**
   * The fully encoded body, including the closing boundary. This loads every file part into
   * memory; prefer {@link #bodyPublisher()} for sending requests.
   */
  public byte[] toBytes() {
    try (InputStream in = openStream()) {
      return in.readAllBytes();
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private InputStream openStream() {
    List<InputStream> streams = new ArrayList<>();
    try {
      for (Part part : allParts()) {
        streams.add(part.open());
      }
    } catch (IOException e) {
      for (InputStream open : streams) {
        try {
          open.close();
        } catch (IOException ignored) {
          // best effort cleanup
        }
      }
      throw new UncheckedIOException(e);
    }
    return new SequenceInputStream(Collections.enumeration(streams));
  }

  private List<Part> allParts() {
    List<Part> all = new ArrayList<>(parts);
    all.add(new BytesPart(ascii("--" + boundary + "--\r\n")));
    return all;
  }

  private byte[] fileHeader(String fieldName, String filename, String contentType) {
    String type = contentType == null ? "application/octet-stream" : contentType;
    return ascii(
        "--"
            + boundary
            + "\r\nContent-Disposition: form-data; name=\""
            + fieldName
            + "\"; filename=\""
            + filename
            + "\"\r\nContent-Type: "
            + type
            + "\r\n\r\n");
  }

  private static byte[] ascii(String s) {
    return s.getBytes(StandardCharsets.US_ASCII);
  }

  private interface Part {
    long size() throws IOException;

    InputStream open() throws IOException;
  }

  private static final class BytesPart implements Part {
    private final byte[] bytes;

    BytesPart(byte[] bytes) {
      this.bytes = bytes;
    }

    @Override
    public long size() {
      return bytes.length;
    }

    @Override
    public InputStream open() {
      return new ByteArrayInputStream(bytes);
    }
  }

  private static final class FilePart implements Part {
    private final Path path;

    FilePart(Path path) {
      this.path = path;
    }

    @Override
    public long size() throws IOException {
      return Files.size(path);
    }

    @Override
    public InputStream open() throws IOException {
      return Files.newInputStream(path);
    }
  }
}
