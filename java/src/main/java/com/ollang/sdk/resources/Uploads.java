package com.ollang.sdk.resources;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.ollang.sdk.MultipartBody;
import com.ollang.sdk.OllangClient;
import java.io.IOException;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/**
 * Upload source files (video, audio, documents) and VTT subtitle files.
 *
 * <p>The {@link Path} overloads stream the file from disk while the request is sent, so large
 * media files do not need to fit in memory.
 */
public class Uploads {

  private final OllangClient client;
  private final Gson gson = new Gson();

  public Uploads(OllangClient client) {
    this.client = client;
  }

  /** Uploads a file from disk directly, creating a project for it. */
  public JsonElement direct(Path file, String name, String sourceLanguage) {
    return direct(file, name, sourceLanguage, null);
  }

  /**
   * Uploads a file from disk directly, creating a project for it. The file is streamed, not
   * loaded into memory.
   *
   * @param file path to the file to upload
   * @param name display name for the created project
   * @param sourceLanguage source language code, e.g. {@code "en"}
   * @param notes optional notes, each like {@code {"details": "...", "timeStamp": "00:01:23"}};
   *     may be {@code null}
   */
  public JsonElement direct(
      Path file, String name, String sourceLanguage, List<Map<String, String>> notes) {
    String filename = file.getFileName().toString();
    MultipartBody body =
        new MultipartBody().addFile("file", filename, file, guessContentType(file, filename));
    return client.postMultipart("/integration/upload/direct", withDirectFields(body, name, sourceLanguage, notes));
  }

  /**
   * Uploads in-memory file content directly, creating a project for it.
   *
   * @param content raw file bytes
   * @param filename filename sent in the multipart part, e.g. {@code "video.mp4"}
   * @param name display name for the created project
   * @param sourceLanguage source language code, e.g. {@code "en"}
   * @param notes optional notes, each like {@code {"details": "...", "timeStamp": "00:01:23"}};
   *     may be {@code null}
   */
  public JsonElement direct(
      byte[] content,
      String filename,
      String name,
      String sourceLanguage,
      List<Map<String, String>> notes) {
    MultipartBody body = new MultipartBody().addFile("file", filename, content, null);
    return client.postMultipart("/integration/upload/direct", withDirectFields(body, name, sourceLanguage, notes));
  }

  /** Uploads a VTT subtitle file from disk for an existing order. The file is streamed. */
  public JsonElement vtt(Path file, String orderId) {
    MultipartBody body =
        new MultipartBody()
            .addFile("file", file.getFileName().toString(), file, "text/vtt")
            .addField("orderId", orderId);
    return client.postMultipart("/integration/upload/vtt", body);
  }

  /** Uploads in-memory VTT subtitle content for an existing order. */
  public JsonElement vtt(byte[] content, String filename, String orderId) {
    MultipartBody body =
        new MultipartBody()
            .addFile("file", filename, content, "text/vtt")
            .addField("orderId", orderId);
    return client.postMultipart("/integration/upload/vtt", body);
  }

  private MultipartBody withDirectFields(
      MultipartBody body, String name, String sourceLanguage, List<Map<String, String>> notes) {
    body.addField("name", name).addField("sourceLanguage", sourceLanguage);
    if (notes != null) {
      body.addField("notes", gson.toJson(notes));
    }
    return body;
  }

  private static String guessContentType(Path file, String filename) {
    String type = null;
    try {
      type = Files.probeContentType(file);
    } catch (IOException ignored) {
      // fall through to the filename-based guess
    }
    if (type == null) {
      type = URLConnection.guessContentTypeFromName(filename);
    }
    return type; // null falls back to application/octet-stream in MultipartBody
  }
}
