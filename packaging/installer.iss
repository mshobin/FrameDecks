; Inno Setup script for the BSF Command Center Windows installer.
; Build (after PyInstaller):  ISCC.exe /DAppVersion=3.0 packaging\installer.iss
; Installs for the current user only: no administrator permission needed, updates never need it either.

#ifndef AppVersion
  #define AppVersion "0.0"
#endif

[Setup]
; Keep this AppId the same forever, so new versions install over old ones
AppId={{D0EFEBEA-94E5-50C7-A69D-45F04529103B}
AppName=BSF Command Center
AppVersion={#AppVersion}
AppVerName=BSF Command Center {#AppVersion}
AppPublisher=Shobin Mathews
AppContact=mshobin@gmail.com
AppSupportURL=mailto:mshobin@gmail.com
AppComments=Independent tool by Shobin Mathews. Not affiliated with or endorsed by Bible Study Fellowship International.
VersionInfoVersion={#AppVersion}
VersionInfoCompany=Shobin Mathews
VersionInfoDescription=BSF Command Center Setup
VersionInfoCopyright=Copyright (C) Shobin Mathews
DefaultDirName={localappdata}\Programs\BSF Command Center
DisableDirPage=yes
DefaultGroupName=BSF Command Center
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=BSF-Command-Center-Setup-{#AppVersion}
SetupIconFile=bsf.ico
UninstallDisplayIcon={app}\BSF Command Center.exe
UninstallDisplayName=BSF Command Center
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
CloseApplications=force
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "Create a desktop icon"; GroupDescription: "Icons:"
Name: "startup"; Description: "Start BSF Command Center automatically when I sign in to Windows"; GroupDescription: "Options:"; Flags: unchecked

[Files]
Source: "..\dist\BSF Command Center\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[InstallDelete]
; remove files left by an older version before copying the new ones
Type: filesandordirs; Name: "{app}\_internal"

[Icons]
Name: "{autoprograms}\BSF Command Center"; Filename: "{app}\BSF Command Center.exe"
Name: "{autodesktop}\BSF Command Center"; Filename: "{app}\BSF Command Center.exe"; Tasks: desktopicon
Name: "{userstartup}\BSF Command Center"; Filename: "{app}\BSF Command Center.exe"; Tasks: startup

[Run]
Filename: "{app}\BSF Command Center.exe"; Description: "Open BSF Command Center now"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/IM ""BSF Command Center.exe"" /F"; Flags: runhidden; RunOnceId: "StopApp"

[Code]
const
  WebView2Key = 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  WebView2KeyUser = 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

function HasWebView2: Boolean;
var v: String;
begin
  Result := (RegQueryStringValue(HKLM, WebView2Key, 'pv', v) and (v <> '') and (v <> '0.0.0.0')) or
            (RegQueryStringValue(HKCU, WebView2KeyUser, 'pv', v) and (v <> '') and (v <> '0.0.0.0'));
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  if not HasWebView2 then
    MsgBox('Microsoft Edge WebView2 (a free Windows component) was not found.' + #13#10 + #13#10 +
           'BSF Command Center will still work, but it will open in your web browser instead of its own window.' + #13#10 +
           'To get the app window, install "WebView2 Runtime" from microsoft.com (search "WebView2 Runtime download").',
           mbInformation, MB_OK);
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var dataDir: String;
begin
  if CurUninstallStep = usPostUninstall then
  begin
    dataDir := ExpandConstant('{userappdata}\BSF Command Center');
    if DirExists(dataDir) then
      if MsgBox('Also delete your BSF Command Center data?' + #13#10 + #13#10 +
                'This includes your saved verses and questions, members, settings and backups in:' + #13#10 + dataDir + #13#10 + #13#10 +
                'Choose No to keep it (recommended if you will install again).',
                mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
        DelTree(dataDir, True, True, True);
  end;
end;
