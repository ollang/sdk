package com.ollang.sdk;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Minimal builder for {@code multipart/form-data} request bodies. */
public final class MultipartBody {

  private final String boundary;
  private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();

  public MultipartBody() {
    this.boundary = "ollang-" + UUID.randomUUID();
  }

  public MultipartBody addField(String name, String value) {
    writeAscii("--" + boundary + "\r\n");
    writeAscii("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n");
    write(value.getBytes(StandardCharsets.UTF_8));
    writeAscii("\r\n");
    return this;
  }

  public MultipartBody addFile(String fieldName, String filename, byte[] content, String contentType) {
    writeAscii("--" + boundary + "\r\n");
    writeAscii(
        "Content-Disposition: form-data; name=\"" + fieldName + "\"; filename=\"" + filename + "\"\r\n");
    writeAscii("Content-Type: " + (contentType == null ? "application/octet-stream" : contentType) + "\r\n\r\n");
    write(content);
    writeAscii("\r\n");
    return this;
  }

  /** The value for the request's {@code Content-Type} header. */
  public String contentType() {
    return "multipart/form-data; boundary=" + boundary;
  }

  /** The encoded body, including the closing boundary. */
  public byte[] toBytes() {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    try {
      buffer.writeTo(out);
      out.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.US_ASCII));
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    return out.toByteArray();
  }

  private void writeAscii(String s) {
    write(s.getBytes(StandardCharsets.US_ASCII));
  }

  private void write(byte[] bytes) {
    buffer.write(bytes, 0, bytes.length);
  }
}
