# Budget de JavaScript da refatoração

O critério obrigatório do plano é manter o JavaScript inicial abaixo de
711.224 bytes, equivalente à linha de base de 677.356 bytes mais 5%. Os chunks
de rota também são medidos como guardrails diagnósticos.

| Escopo | Base | Resultado | Variação | Decisão |
|---|---:|---:|---:|---|
| JavaScript inicial | 677.356 B | 689.240 B | +1,75% | Aprovado |
| `ProfilePage` | 98.496 B | 102.941 B | +4,51% | Aprovado |
| `GameDetailsPage` | 43.972 B | 49.866 B | +13,40% | Exceção documentada |
| `CommunityDetailsPage` | 47.174 B | 64.189 B | +36,07% | Exceção documentada |

`GameDetailsPage` passou a conter paginação real de reviews e comentários,
resolução de deep links, fallback restrito para RPC ausente e proteção contra
respostas obsoletas. `CommunityDetailsPage` passou a conter controllers com
proteção de corrida, paginação de membros e comentários, resolução de âncoras e
compensação segura de mídia. Esses módulos continuam carregados apenas quando
as respectivas rotas lazy são acessadas; o crescimento inicial total ficou em
1,75%.

Dividir esses fluxos com imports dinâmicos internos nesta etapa adicionaria
estados transitórios e risco de remount em abas/modais. A otimização fica
registrada para uma etapa própria com comparação visual e de requests.

Os valores devem ser atualizados com a saída final de `npm run build` seguida
de `npm run check:bundle` sempre que os chunks mudarem.
