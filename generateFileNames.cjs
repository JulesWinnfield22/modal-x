#!/usr/bin/env node

const { readdir, stat, writeFileSync, watch } = require("fs");
const { join } = require("path");

const directoryPath = join(__dirname, "../../../");
const outputPath = join(__dirname, "FileNameEnums.ts");

let enumEntries = [];

function createFileNames() {
  const names = enumEntries.sort().join(" | ");

  const enumContent = `export type FileNames = ${names}`;

  writeFileSync(outputPath, enumContent);
}

const generateEnum = (files) => {
  let modals = files
    .filter((file) => [".mdl", ".amdl"].find((el) => file.includes(el))) // Adjust file type as needed
    .map((file) => {
      console.log(file);
      return `'${file.split("/").at(-1).split(".")?.[0]}'`;
    });

  enumEntries.push(...modals);
  createFileNames();
};

// Initial enum generation
const debounceDelay = 100; // milliseconds
let lastEventTime = 0;

function watchDirectory(dir) {
  const found = dir.split("/").find((el) => el.startsWith("."));
  if (
    found ||
    [
      "assets",
      "composables",
      "node_modules",
      "dist",
      "config",
      "directives",
      "middleware",
      "plugins",
      "server",
      "service",
      "stores",
      "store",
      "types",
      "type",
      "utils",
    ].find((el) => dir.includes(el))
  )
    return;

  // Watch the current directory
  watch(dir, (eventType, filename) => {
    const currentTime = Date.now();
    // Debounce: Check if the last event was too recent
    if (currentTime - lastEventTime < debounceDelay) {
      return;
    }
    lastEventTime = currentTime;
    const isModal = [".mdl", ".amdl"].find((el) => filename.includes(el));
    const name = filename.split("/").at(-1).split(".")[0];

    if (isModal && enumEntries.includes(`'${name}'`)) {
      enumEntries = enumEntries.filter((el) => el != `'${name}'`);
      createFileNames();
    } else if (isModal) {
      generateEnum([filename]);
    }
  });

  // Read the contents of the directory to find nested directories
  readdir(dir, (err, files) => {
    if (err) {
      return console.error(`Unable to scan directory: ${err}`);
    }

    generateEnum(files);
    files.forEach((file) => {
      const filePath = join(dir, file);

      stat(filePath, (err, stats) => {
        if (err) {
          console.error(`Unable to stat file: ${err}`);
          return;
        }

        // If it's a directory, watch it recursively
        if (stats.isDirectory()) {
          watchDirectory(filePath); // Recursively watch this directory
        }
      });
    });
  });
}

// Start watching the main directory
watchDirectory(directoryPath);
console.log(`\n Watching for changes in ${directoryPath}...\n`);
