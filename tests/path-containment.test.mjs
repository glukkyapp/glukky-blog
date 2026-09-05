import assert from "node:assert/strict"
import test from "node:test"
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises"
import { get } from "node:http"
import { once } from "node:events"
import { tmpdir } from "node:os"
import { resolve } from "node:path"

import { isPathWithinRoot } from "../carer-landing/path-containment.mjs"
import { createCarerLandingServer } from "../carer-landing/serve.mjs"

const root = resolve("/tmp", "carer-landing")

test("allows the document root and its descendants", () => {
  assert.equal(isPathWithinRoot(root, root), true)
  assert.equal(isPathWithinRoot(root, resolve(root, "images", "logo.png")), true)
})

test("rejects traversal and prefix-sharing siblings", () => {
  assert.equal(isPathWithinRoot(root, resolve(root, "..", "secret.txt")), false)
  assert.equal(
    isPathWithinRoot(root, resolve(root, "..", "carer-landing-private", "secret.txt")),
    false
  )
})

function requestStatus(port, path) {
  return new Promise((resolveStatus, reject) => {
    const request = get({ hostname: "127.0.0.1", port, path }, (response) => {
      response.resume()
      resolveStatus(response.statusCode)
    })
    request.on("error", reject)
  })
}

test("the HTTP server rejects symlink escapes while serving contained files", async () => {
  const temporaryDirectory = await mkdtemp(resolve(tmpdir(), "carer-path-test-"))
  const testRoot = resolve(temporaryDirectory, "public")
  const outsideFile = resolve(temporaryDirectory, "secret.txt")
  const link = resolve(testRoot, "linked-secret.txt")
  let server

  try {
    await mkdir(testRoot)
    await writeFile(resolve(testRoot, "index.html"), "safe")
    await writeFile(outsideFile, "secret")
    await symlink(outsideFile, link)

    server = await createCarerLandingServer(testRoot)
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    assert.equal(typeof address, "object")

    assert.equal(await requestStatus(address.port, "/"), 200)
    assert.equal(await requestStatus(address.port, "/linked-secret.txt"), 403)
  } finally {
    if (server?.listening) {
      server.close()
      await once(server, "close")
    }
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})