; Extra steps of the English Path installer (electron-builder NSIS).
!macro customInstall
  ; Before 2.0 the app was the portable "Oxford Cards.exe" with a hand-made desktop shortcut; English Path replaces it.
  SetShellVarContext current
  Delete "$DESKTOP\Oxford Cards.lnk"
  SetShellVarContext all
!macroend
