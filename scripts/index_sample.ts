async function main() {
  const pdf = process.argv[2];
  if (!pdf) {
    console.error("Pass a PDF URL or base64 value as the first argument");
    process.exit(1);
  }

  const response = await fetch("http://localhost:3000/documents/index", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      pdf,
      collection: "developer-documents",
      documentId: "release-2026-09-13",
      lang: "eng",
      quality: "high",
      buildId: "web-1842",
      release: "2026.09.13",
    }),
  });

  const result: unknown = await response.json();
  console.log(JSON.stringify(result, null, 2));
  if (!response.ok) process.exitCode = 1;
}

void main();
