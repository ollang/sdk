package com.ollang.sdk.resources;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.ollang.sdk.MultipartBody;
import com.ollang.sdk.OllangClient;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/** Upload source files (video, audio, documents) and VTT subtitle files. */
public class Uploads {

  private final OllangClient client;
  private final Gson gson = new Gson();

  public Uploads(OllangClient client) {
    this.client = client;
  }

  /** Uploads a file from disk directly, creating a project for it. */
  public JsonElement direct(Path file, String name, String sourceLanguage) {
    return direct(readBytes(file), file.getFileName().toString(), name, sourceLanguage, null);
  }

  /**
   * Uploads file content directly, creating a project for it.
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
    MultipartBody body =
        new MultipartBody()
            .addFile("file", filename, content, null)
            .addField("name", name)
            .addField("sourceLanguage", sourceLanguage);
    if (notes != null) {
      body.addField("notes", gson.toJson(notes));
    }
    return client.postMultipart("/integration/upload/direct", body);
  }

  /** Uploads a VTT subtitle file from disk for an existing order. */
  public JsonElement vtt(Path file, String orderId) {
    return vtt(readBytes(file), file.getFileName().toString(), orderId);
  }

  /** Uploads VTT subtitle content for an existing order. */
  public JsonElement vtt(byte[] content, String filename, String orderId) {
    MultipartBody body =
        new MultipartBody()
            .addFile("file", filename, content, "text/vtt")
            .addField("orderId", orderId);
    return client.postMultipart("/integration/upload/vtt", body);
  }

  private static byte[] readBytes(Path file) {
    try {
      return Files.readAllBytes(file);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }
}
