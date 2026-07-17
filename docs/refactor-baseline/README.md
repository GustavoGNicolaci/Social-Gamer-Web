# Referencia visual da refatoracao

Estas capturas registram o comportamento visual anterior as extracoes estruturais.
Elas devem ser comparadas depois de cada etapa que mova JSX ou altere a composicao das rotas.

Tamanhos de referencia:

- Desktop: 1440 x 900.
- Mobile: 390 x 844.

As capturas usam dados publicos do ambiente configurado no frontend e nao contem credenciais.
Estados autenticados e a matriz completa de privacidade sao validados por testes de caracterizacao.

O idioma anonimo e definido pelo navegador. No navegador automatizado desta auditoria ele e
`en-US`; a paridade e o comportamento `pt-BR` continuam cobertos pelos testes de i18n e serao
verificados visualmente quando houver uma sessao local com seletor de idioma disponivel.

Capturas registradas:

| Rota | Desktop escuro | Mobile claro | Estado |
| --- | --- | --- | --- |
| Detalhes do jogo | `game-details-desktop-1440x900-en-dark.png` | `game-details-mobile-390x844-en-light.png` | Jogo publico carregado |
| Perfil | `profile-desktop-1440x900-en-dark.png` | `profile-mobile-390x844-en-light.png` | Perfil publico inexistente |
| Comunidade | `community-details-desktop-1440x900-en-dark.png` | `community-details-mobile-390x844-en-light.png` | Comunidade inexistente/privada |

Os estados completos de perfil e comunidade nao puderam ser capturados porque o ambiente remoto
nao possui registros publicos disponiveis para essas rotas. Esses contratos estao congelados nos
testes `ProfilePage.test.tsx` e `CommunityDetailsPage.test.tsx`.
