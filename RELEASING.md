# Releasing the Ollang SDKs

How each library in this repo is published, and the one-time setup each
registry needs.

| Library    | Registry      | Workflow                                | Trigger                       |
| ---------- | ------------- | --------------------------------------- | ----------------------------- |
| TypeScript | npm           | `.github/workflows/publish.yml`         | push to `main`                |
| Python     | PyPI          | `.github/workflows/publish-python.yml`  | tag `python-v<version>`       |
| Java       | Maven Central | `.github/workflows/publish-java.yml`    | tag `java-v<version>`         |

Tags are used for Python and Java because PyPI and Maven Central permanently
reject re-uploads of an existing version — every release needs an explicit
version bump.

---

## Python (PyPI)

### One-time setup

Uses [trusted publishing](https://docs.pypi.org/trusted-publishers/) — no API
token or secret is stored in GitHub.

1. Create a PyPI account (or use the Ollang org account) at https://pypi.org.
2. Go to **Publishing** → **Add a new pending publisher** and register:
   - PyPI project name: `ollang-sdk`
   - Owner: `ollang`
   - Repository: `sdk`
   - Workflow name: `publish-python.yml`
   - Environment: `pypi`
3. In this GitHub repo, create an environment named `pypi`
   (**Settings → Environments**). Optionally add required reviewers to gate
   releases.

The first successful workflow run claims the `ollang-sdk` name on PyPI.

### Releasing a version

1. Bump `version` in `python/pyproject.toml` **and** `__version__` in
   `python/src/ollang/__init__.py` (keep them equal).
2. Merge to `main`, then tag and push:

   ```bash
   git tag python-v0.1.0
   git push origin python-v0.1.0
   ```

The workflow runs the tests, verifies the tag matches the package version,
builds the sdist + wheel, and publishes. After that, `pip install ollang-sdk`
works for everyone.

---

## Java (Maven Central)

### One-time setup

Publishes through the [Sonatype Central portal](https://central.sonatype.org/register/central-portal/).

1. **Register and verify the namespace**: sign up at
   https://central.sonatype.com, add the namespace `com.ollang`, and verify it
   via the DNS TXT record it gives you (you control ollang.com, so this is a
   one-line DNS change).
2. **Generate a user token**: in the portal, **View Account → Generate User
   Token**. Store the two values as GitHub Actions secrets:
   - `CENTRAL_USERNAME` — the token username
   - `CENTRAL_PASSWORD` — the token password
3. **Create a GPG signing key** (Central requires signed artifacts):

   ```bash
   gpg --gen-key   # use e.g. "Ollang <dev@ollang.com>"; note the key ID
   gpg --keyserver keyserver.ubuntu.com --send-keys <KEY_ID>   # publish the public key
   gpg --armor --export-secret-keys <KEY_ID>                   # export the private key
   ```

   Store as GitHub Actions secrets:
   - `MAVEN_GPG_PRIVATE_KEY` — the full ASCII-armored private key
   - `MAVEN_GPG_PASSPHRASE` — the key's passphrase

### Releasing a version

1. Bump `<version>` in `java/pom.xml`.
2. Merge to `main`, then tag and push:

   ```bash
   git tag java-v0.1.0
   git push origin java-v0.1.0
   ```

The workflow runs the tests, verifies the tag matches the pom version, builds
the jar plus sources/javadoc jars, signs everything, and uploads to Central
(auto-publish is on; propagation to Maven Central search takes up to ~30
minutes). After that the dependency resolves for everyone:

```xml
<dependency>
  <groupId>com.ollang</groupId>
  <artifactId>ollang-sdk</artifactId>
  <version>0.1.0</version>
</dependency>
```

To dry-run the release build locally without signing or uploading:

```bash
cd java && mvn -P release -DskipTests -Dgpg.skip=true verify
```

---

## Until the first release

Both libraries are fully usable straight from the repo:

- **Python**: `pip install "git+ssh://git@github.com/ollang/sdk.git@main#subdirectory=python"`
- **Java**: clone the repo, run `mvn install` in `java/`, then depend on
  `com.ollang:ollang-sdk:0.1.0` from the local Maven repository.
