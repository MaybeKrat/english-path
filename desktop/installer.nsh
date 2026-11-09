; Extra pages, texts and steps of the English Path installer (electron-builder NSIS, assisted mode).
; Pictures: desktop/resources/installerSidebar.bmp, uninstallerSidebar.bmp and installerHeader.bmp,
; made by scripts/create-installer-images.mjs from desktop/installer/*.svg.
; This file is included before electron-builder's own pages, so the page texts below apply to them.

; Without this Windows draws the installer at 100% and stretches the whole window to the screen scale, so text
; and pictures come out blurry (Ivan, 09.11.2026, at 125%). electron-builder does not set it.
ManifestDPIAware true

!ifndef BUILD_UNINSTALLER
  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "Установка English Path"
    !define MUI_WELCOMEPAGE_TEXT "English Path — английские слова, неправильные глаголы и грамматика с интервальным повторением.$\r$\n$\r$\nЕсли приложение уже установлено, новая версия встанет поверх старой. Прогресс обучения сохранится.$\r$\n$\r$\nНажмите «Далее», чтобы продолжить."
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  ; The desktop shortcut is the learner's choice (Ivan, 09.11.2026): a checkbox page after the folder page, checked
  ; by default; the shortcut is made with the files in customInstall. A checkbox on the finish page did not work.
  !macro customPageAfterChangeDir
    Page custom shortcutPageCreate shortcutPageLeave
  !macroend

  !define MUI_FINISHPAGE_TITLE "English Path установлено"
  !define MUI_FINISHPAGE_TEXT "Записи произношения скачаются в фоне при первом запуске; до этого слова читает голос Windows.$\r$\n$\r$\nНажмите «Готово», чтобы закрыть установщик."

  ; Inserted by electron-builder after MUI2 and its plugins are loaded, before the install section.
  !macro customHeader
    !include nsDialogs.nsh
    Var desktopShortcutBox
    ; Empty in a silent update (the page is not shown): the shortcut then stays as it was.
    Var desktopShortcutState

    Function shortcutPageCreate
      !insertmacro MUI_HEADER_TEXT "Ярлык" "Где показать English Path"
      nsDialogs::Create 1018
      Pop $0
      ${NSD_CreateLabel} 0 0 100% 24u "Ярлык в меню «Пуск» создаётся всегда. Ярлык на рабочем столе — по желанию."
      Pop $0
      ${NSD_CreateCheckbox} 0 30u 100% 12u "Создать ярлык на рабочем столе"
      Pop $desktopShortcutBox
      ${if} $desktopShortcutState != ${BST_UNCHECKED}
        ${NSD_Check} $desktopShortcutBox
      ${endIf}
      nsDialogs::Show
    FunctionEnd

    Function shortcutPageLeave
      ${NSD_GetState} $desktopShortcutBox $desktopShortcutState
    FunctionEnd
  !macroend
!endif

!macro customInstall
  ; Before 2.0 the app was the portable "Oxford Cards.exe" with a hand-made desktop shortcut; English Path replaces it.
  SetShellVarContext current
  Delete "$DESKTOP\Oxford Cards.lnk"
  SetShellVarContext all

  ${if} $desktopShortcutState == ${BST_CHECKED}
    CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\${PRODUCT_FILENAME}.exe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$DESKTOP\${SHORTCUT_NAME}.lnk" "${APP_ID}"
  ${elseIf} $desktopShortcutState == ${BST_UNCHECKED}
    WinShell::UninstShortcut "$DESKTOP\${SHORTCUT_NAME}.lnk"
    Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  ${endIf}
  System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  ; electron-builder does not remove a shortcut it did not create; an update keeps it.
  ${ifNot} ${isKeepShortcuts}
    WinShell::UninstShortcut "$DESKTOP\${SHORTCUT_NAME}.lnk"
    Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  ${endIf}
!macroend
