# Calendário

Calendário simples para Windows, no estilo do calendário do iPhone.

- Tela inicial; clique em qualquer lugar para entrar
- Visão do ano com os 12 meses
- Clique em um mês para abrir (com zoom); botão no canto superior direito volta para o ano
- Setas ← → trocam o mês/ano, Esc volta para o ano
- Tema claro/escuro conforme o Windows

## Stack

- Tauri 2 (Rust)
- HTML, CSS e JavaScript puro (sem framework, sem bundler)
- Instalador NSIS

## Instalar

Baixe o `Calendario_x.x.x_x64-setup.exe` da última versão em [Releases](https://github.com/FellipeFTeixeira/calender/releases/latest) e execute. Instala só para o usuário atual, sem precisar de administrador.

O instalador não é assinado digitalmente. Se o Windows mostrar o aviso do SmartScreen, clique em "Mais informações" > "Executar assim mesmo".

Requer WebView2 (já vem no Windows 10/11; se faltar, o instalador baixa).

## Compilar

Requisitos:

- Node.js
- Rust (`winget install Rustlang.Rustup`)
- Visual Studio Build Tools com C++ (`winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`)

```
npm install
npm run dev     # rodar em modo desenvolvimento
npm run build   # gerar o .exe e o instalador
```

Saída:

- `src-tauri/target/release/calendario.exe`
- `src-tauri/target/release/bundle/nsis/Calendário_1.0.0_x64-setup.exe`
