; Additions to electron-builder's NSIS installer (electron-builder.yml → nsis.include).

; Always install for the current user (%LOCALAPPDATA%\Programs), so no admin rights are needed
; and the "Only for me / Anyone who uses this computer" page is skipped.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; The assisted installer has no welcome page by default; this one shows the sidebar image.
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend
