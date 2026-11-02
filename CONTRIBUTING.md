# Contribuindo

Obrigado por ajudar! Este guia é curto de propósito.

## Ambiente
```bash
npm install
npm run dev
```
Node 20.19+ (recomendado 22). Para o Android: JDK 21 e Android SDK.

## Antes de abrir um Pull Request
```bash
npm run check      # typecheck + lint + testes
npm run format     # Prettier
```
O CI roda os mesmos passos.

## Convenções
- **Lógica nova vai em `src/lib/`** quando possível (funções/classes puras, sem React/Capacitor) e **com teste** (`*.test.ts` ao lado).
- Serviços recebem dependências por construtor (veja `MidiService`) para serem testáveis sem hardware.
- **Textos da interface**: use `tr('Texto em português')` e adicione a tradução em `src/i18n/en.ts`. O teste de i18n falha se faltar alguma.
- Estado compartilhado e persistente: `createStore` (`src/lib/storeCore.ts`) + `useStore`.
- Nada de `localStorage` direto nos componentes.
- Mensagens de commit no imperativo, em português ou inglês (`Corrige X`, `Adiciona Y`).

## Android
O plugin nativo fica em `android/app/src/main/java/com/midi/controller/keyboard/plugins/`. Depois de alterar o JS/TS:
```bash
npm run cap:sync
```
**Não versione** `android/app/src/main/assets/public` nem os arquivos `capacitor.config.json`/`capacitor.plugins.json` gerados (já estão no `.gitignore`).

## Reportando bugs
Informe modelo do aparelho, versão do Android, dispositivo MIDI usado (USB/BLE) e, se possível, o que o **Monitor MIDI** mostra.
