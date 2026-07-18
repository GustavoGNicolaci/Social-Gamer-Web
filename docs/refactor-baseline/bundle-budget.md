# Budget de JavaScript da refatoração

O critério obrigatório do plano é manter o JavaScript inicial abaixo de
711.224 bytes, equivalente à linha de base de 677.356 bytes mais 5%. Os chunks
de rota também são medidos como guardrails diagnósticos.

| Escopo | Base | Resultado | Variação | Decisão |
|---|---:|---:|---:|---|
| JavaScript inicial | 677.356 B | 686.987 B | +1,42% | Aprovado |
| `GamesPage` | 14.851 B | 15.559 B | +4,77% | Aprovado |
| `ProfilePage` | 98.496 B | 109.172 B | +10,84% | Exceção documentada |
| `GameDetailsPage` | 43.972 B | 69.525 B | +58,11% | Exceção documentada |
| `CommunityDetailsPage` | 47.174 B | 66.616 B | +41,21% | Exceção documentada |

`GamesPage` ficou 35 bytes abaixo do teto depois da remoção de campos sem
consumidores, de um ramo nunca usado e de cálculos repetidos por card.

No perfil, uma medição isolada e minificada atribuiu aproximadamente 5,1 kB do
excedente aos controllers específicos de status, reordenação com rollback da
wishlist e Top 5, além de toolbar, editor e tabs extraídos. Reverter esse corte
apenas para reduzir o chunk recolocaria estado, efeitos e UI nas seções
monolíticas; o limite nominal não foi aumentado.

`GameDetailsPage` contém paginação real de reviews e comentários, resolução de
deep links, fallback restrito para RPC ausente, total global de comentários e
proteção contra respostas obsoletas. `CommunityDetailsPage` contém controllers
de composer, feed, comentários e confirmações, com paginação, âncoras e
compensação segura de mídia. Esses módulos continuam carregados apenas quando
as respectivas rotas lazy são acessadas; o crescimento inicial total ficou em
1,42%.

Dividir esses fluxos com imports dinâmicos internos nesta etapa adicionaria
estados transitórios e risco de remount em abas/modais. A otimização fica
registrada para uma etapa própria com comparação visual e de requests.

Os valores devem ser atualizados com a saída final de `npm run build` seguida
de `npm run check:bundle` sempre que os chunks mudarem.
