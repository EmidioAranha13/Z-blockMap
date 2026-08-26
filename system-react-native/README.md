# Z-blockMap — mobile (React Native + Expo)

Editor de mapas em blocos para **Android** e **iPhone**. É o porte do `system-vue`, com gestos de toque no lugar de mouse e scroll.

## O que muda no celular

- **1 dedo:** pinta (pincel, borracha, tinta, linha, círculo, mover desenho).
- **2 dedos:** arrasta o mapa (o mesmo que o botão direito no web).
- **Pinça:** zoom com o ponto entre os dedos.
- Botão de **mover tudo** (seta de 4 pontas): com ele ligado, 1 dedo também arrasta o mapa.
- Ferramentas na faixa inferior; escala, camadas, cores e arquivos no botão **Painel**.
- Salvar / carregar usa o compartilhamento e o seletor de arquivos do sistema (`.zblockmap.json`, o mesmo formato do web).

## Pré-requisitos

- [Node.js](https://nodejs.org/) 18 ou superior
- App **Expo Go** no celular ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779))
- Celular e computador na mesma rede Wi-Fi

## Como executar

Nesta pasta:

```bash
npm install
npx expo start
```

Leia o QR code com o Expo Go (Android: câmera do app; iPhone: câmera do sistema).

| Comando | O que faz |
|---|---|
| `npx expo start` | Servidor de desenvolvimento |
| `npx expo start --android` | Abre no emulador Android (se houver) |
| `npx expo start --ios` | Abre no Simulator (somente macOS) |

A primeira abertura no Expo Go baixa as bibliotecas nativas (Skia, gestos). Depois o recarregamento é rápido.

## Compatibilidade de arquivo

Os mapas `.zblockmap.json` gerados no web abrem neste app, e o contrário também.
