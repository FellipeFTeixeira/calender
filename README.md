# Calendário

Calendário simples para Windows, no estilo do calendário do iPhone.

- Tela inicial; clique em qualquer lugar para entrar
- Visão do ano com os 12 meses
- Clique em um mês para abrir (com zoom); botão no canto superior direito volta para o ano
- Clique em um dia para abrir as notas daquele dia (editor do app Notas, dentro do calendário)
- Feriados nacionais marcados; passe o mouse para ver detalhes e link da Wikipédia
- Setas ← → trocam o mês/ano, Esc volta
- Tema claro/escuro conforme o Windows
- Avisa quando tem versão nova e se atualiza com um clique

As notas ficam em `Documentos\Calendario\data` (um arquivo JSON por nota, imagens em `attachments`).

## Stack

- Tauri 2 (Rust)
- Calendário em HTML, CSS e JavaScript puro
- Notas em React + TipTap (carregado só quando abre um dia)
- Vite para o build do frontend
- Instalador NSIS, atualização pelo plugin updater do Tauri (GitHub Releases)

## Instalar ou atualizar

**[Clique aqui para baixar](https://github.com/FellipeFTeixeira/calender/releases/latest/download/Calendario-setup.exe)**, abra o arquivo baixado e pronto.

Para atualizar, não precisa fazer nada: quando sair uma versão nova, o app mostra um aviso embaixo. É só clicar em **Atualizar**. Suas notas continuam salvas.

(Quem está na versão 1.1.0 ou anterior precisa baixar pelo link acima uma vez; dali em diante o app se atualiza sozinho.)

Se aparecer o aviso azul do Windows, clique em "Mais informações" > "Executar assim mesmo".

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
- `src-tauri/target/release/bundle/nsis/Calendário_x.x.x_x64-setup.exe`

Para gerar uma release com atualização automática, o build precisa da chave de assinatura (fica fora do repositório, em `%USERPROFILE%\.tauri\calendario.key`):

```
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\calendario.key"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npm run build
```

Na release, suba o instalador, uma cópia dele chamada `Calendario-setup.exe` e o `latest.json` (versão, URL do instalador e conteúdo do `.sig`).
