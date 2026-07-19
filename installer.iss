; Ekol — Gestion Scolaire — Installateur Inno Setup
; Compiler avec Inno Setup (https://jrsoftware.org/isdl.php)

#define MyAppName "Ekol"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Bambyno Studio App"
#define MyAppURL "https://github.com/foudroyant/ekol"
#define MyAppExeName "Ekol.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\{#MyAppName}
DefaultGroupName={#MyAppName}
SetupIconFile=.\resources\icons\appIcon.ico
OutputDir=.\dist\installer
OutputBaseFilename=Ekol-Setup-{#MyAppVersion}
Compression=lzma
SolidCompression=yes
UninstallDisplayIcon={app}\{#MyAppExeName}
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "french"; MessagesFile: "compiler:Languages\French.isl"

[Tasks]
Name: "desktopicon"; Description: "Icône sur le bureau"; GroupDescription: "Raccourcis :"

[Files]
Source: "dist\Ekol\Ekol-win_x64.exe"; DestDir: "{app}"; DestName: "Ekol.exe"; Flags: ignoreversion
Source: "dist\Ekol\resources.neu"; DestDir: "{app}"; Flags: ignoreversion
Source: "resources\icons\appIcon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "README.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\appIcon.ico"
Name: "{group}\Désinstaller {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; IconFilename: "{app}\appIcon.ico"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Lancer {#MyAppName}"; Flags: postinstall nowait skipifsilent
