// Where CI's reports go (R2's ev-maps-test-reports bucket, served at
// {SITE_URL}/reports/), and the commit statuses linking to them: shared by
// scripts/publish-test-report.js and scripts/visual-compare.js.
//
// From the environment: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID and
// R2_SECRET_ACCESS_KEY (an R2 API token with Object Read & Write on the
// bucket, for its S3 API); GITHUB_TOKEN and GITHUB_REPOSITORY.

import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { S3Client, file as bunFile } from "bun";

const BUCKET = "ev-maps-test-reports";
const CONCURRENCY = 16;

const env = (name, { optional = false } = {}) => {
  const value = process.env[name];
  if (!value && !optional) {
    throw new Error(`${name} isn't set`);
  }
  return value || null;
};

// The bucket, through R2's S3 API: a bucket-scoped R2 token can't use
// Cloudflare's REST API.
const reportBucket = () =>
  new S3Client({
    accessKeyId: env("R2_ACCESS_KEY_ID"),
    secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    bucket: BUCKET,
    endpoint: `https://${env("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  });

const filesIn = async (directory) =>
  (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

// Every file of a folder under reports/{prefix}, CONCURRENCY at a time.
const uploadFolder = async (directory, prefix) => {
  const bucket = reportBucket();
  const files = await filesIn(directory);
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const file = files[next++];
      const key = `reports/${prefix}${relative(directory, file).split("\\").join("/")}`;
      // Bun.file gives each its content type, e.g. text/html.
      await bucket.write(key, bunFile(file));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return files.length;
};

// A commit status: { state, description, context, url }.
const postCommitStatus = async (commitSha, { state, description, context, url }) => {
  const response = await fetch(
    `https://api.github.com/repos/${env("GITHUB_REPOSITORY")}/statuses/${commitSha}`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${env("GITHUB_TOKEN")}`,
        accept: "application/vnd.github+json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ state, target_url: url, description, context }),
    }
  );
  if (!response.ok) {
    throw new Error(`GitHub status: ${response.status} ${await response.text()}`);
  }
};

export { env, filesIn, postCommitStatus, reportBucket, uploadFolder };
