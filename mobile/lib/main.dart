// Entry point for the FieldFix mobile app.
//
// Phase 1: this is a thin wrapper that loads the PWA served by the
// daemon in a webview, after QR pairing.
//
// Phase 2: replace the webview with native UI and wire in the
// on-device LiteRT-LM tier (see lib/litert/).
//
// See docs/ROADMAP.md for phase details.

import "package:flutter/material.dart";

void main() {
  runApp(const FieldFixApp());
}

class FieldFixApp extends StatelessWidget {
  const FieldFixApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: "FieldFix",
      home: Scaffold(
        appBar: AppBar(title: const Text("FieldFix")),
        body: const Center(
          child: Text("Pairing screen goes here - Phase 1"),
        ),
      ),
    );
  }
}
