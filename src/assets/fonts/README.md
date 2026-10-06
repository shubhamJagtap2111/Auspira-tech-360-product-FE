# Local application fonts

Inter and Material Symbols Rounded are self-hosted so application typography and navigation icons do not require Google Fonts requests at runtime. `fonts.css` is bundled through Angular's global styles; the build emits the WOFF2 files into its media directory.

Inter is distributed under the included SIL Open Font License. Material Symbols Rounded is distributed under the included Apache license. Sources: https://github.com/rsms/inter and https://github.com/google/material-design-icons.

The symbol font includes the names in `material-symbols-icons.json`. When introducing a new icon, check that manifest. To extend it, obtain the current Rounded variable font and codepoints from the official source, then subset with fontTools using the chosen icon codepoints plus ASCII characters, `layout_closure=False`, and WOFF2 output. This preserves ligatures for the selected icon glyphs without retaining every unused symbol. Verify new glyphs in the browser before replacing the bundled font.
