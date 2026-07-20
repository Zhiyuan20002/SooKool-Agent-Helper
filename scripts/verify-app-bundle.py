#!/usr/bin/env python3
"""Verify that a packaged app no longer carries Electron's bundle identity."""

from __future__ import annotations

import argparse
import plistlib
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("app", type=Path)
    args = parser.parse_args()

    app_path = args.app.resolve()
    plist_path = app_path / "Contents/Info.plist"
    with plist_path.open("rb") as handle:
        info = plistlib.load(handle)

    expected = {
        "CFBundleDisplayName": "SooKool 智能体助手",
        "CFBundleName": "SooKool Agent Helper",
        "CFBundleIdentifier": "com.sookool.agenthelper",
        "CFBundleIconFile": "icon.icns",
    }
    errors = [
        f"{key}: expected {value!r}, got {info.get(key)!r}"
        for key, value in expected.items()
        if info.get(key) != value
    ]

    executable = info.get("CFBundleExecutable", "")
    if not executable or executable == "Electron":
        errors.append(f"CFBundleExecutable still uses {executable or 'an empty name'!r}")

    icon_path = app_path / "Contents/Resources" / info.get("CFBundleIconFile", "")
    if not icon_path.is_file():
        errors.append(f"bundle icon is missing: {icon_path}")

    for locale in (
        "en.lproj",
        "zh-Hans.lproj",
        "zh-HK.lproj",
        "ja.lproj",
        "fr.lproj",
        "ko.lproj",
        "es.lproj",
        "pt-BR.lproj",
        "ar.lproj",
    ):
        localized_name = app_path / "Contents/Resources" / locale / "InfoPlist.strings"
        if not localized_name.is_file():
            errors.append(f"localized bundle name is missing: {localized_name}")

    if errors:
        raise SystemExit("Bundle verification failed:\n- " + "\n- ".join(errors))

    print(f"Bundle verification passed: {app_path}")
    print(f"Executable: {executable}")
    print(f"Icon: {icon_path}")


if __name__ == "__main__":
    main()
