package com.ollang.sdk;

import com.google.gson.JsonElement;
import com.ollang.sdk.resources.Billing;
import com.ollang.sdk.resources.Content;
import com.ollang.sdk.resources.CustomInstructions;
import com.ollang.sdk.resources.Figma;
import com.ollang.sdk.resources.Folders;
import com.ollang.sdk.resources.Locales;
import com.ollang.sdk.resources.Memories;
import com.ollang.sdk.resources.Orders;
import com.ollang.sdk.resources.Projects;
import com.ollang.sdk.resources.Revisions;
import com.ollang.sdk.resources.Uploads;
import java.time.Duration;

/**
 * Entry point for the Ollang API.
 *
 * <pre>{@code
 * Ollang ollang = Ollang.builder().apiKey("your-api-key").build();
 * JsonElement projects = ollang.projects().list();
 * }</pre>
 */
public class Ollang {

  private final OllangClient client;
  private final Orders orders;
  private final Projects projects;
  private final Revisions revisions;
  private final Uploads uploads;
  private final CustomInstructions customInstructions;
  private final Memories memories;
  private final Folders folders;
  private final Content content;
  private final Billing billing;
  private final Locales locales;
  private final Figma figma;

  private Ollang(OllangClient client) {
    this.client = client;
    this.orders = new Orders(client);
    this.projects = new Projects(client);
    this.revisions = new Revisions(client);
    this.uploads = new Uploads(client);
    this.customInstructions = new CustomInstructions(client);
    this.memories = new Memories(client);
    this.folders = new Folders(client);
    this.content = new Content(client);
    this.billing = new Billing(client);
    this.locales = new Locales(client);
    this.figma = new Figma(client);
  }

  public static Builder builder() {
    return new Builder();
  }

  public Orders orders() {
    return orders;
  }

  public Projects projects() {
    return projects;
  }

  public Revisions revisions() {
    return revisions;
  }

  public Uploads uploads() {
    return uploads;
  }

  public CustomInstructions customInstructions() {
    return customInstructions;
  }

  public Memories memories() {
    return memories;
  }

  public Folders folders() {
    return folders;
  }

  public Content content() {
    return content;
  }

  public Billing billing() {
    return billing;
  }

  public Locales locales() {
    return locales;
  }

  public Figma figma() {
    return figma;
  }

  public JsonElement healthCheck() {
    return client.get("/health");
  }

  /** The underlying HTTP client, for calling endpoints not yet wrapped. */
  public OllangClient client() {
    return client;
  }

  public static class Builder {
    private String apiKey;
    private String baseUrl;
    private Duration timeout;

    /** Your Ollang API key (from project settings at https://lab.ollang.com). Required. */
    public Builder apiKey(String apiKey) {
      this.apiKey = apiKey;
      return this;
    }

    /** Overrides the API base URL. Defaults to the production integration API. */
    public Builder baseUrl(String baseUrl) {
      this.baseUrl = baseUrl;
      return this;
    }

    /** Request timeout. Defaults to 60 seconds. */
    public Builder timeout(Duration timeout) {
      this.timeout = timeout;
      return this;
    }

    public Ollang build() {
      return new Ollang(new OllangClient(apiKey, baseUrl, timeout));
    }
  }
}
