-- ============================================================================
-- v48 — Report T12: wording coorte neutro (regge coorte T12 sia < sia > della T0)
-- ============================================================================
-- "copre il / pari al {ratioPct}% delle persone esaminate all'avvio" → "corrisponde/
-- corrispondente al {ratioPct}% di quella (esaminata) all'avvio". Motivo: {ratioPct} è
-- il rapporto di numerosità T12/T0 e può superare il 100% (coorte T12 più numerosa);
-- il verbo di copertura implicava (falsamente) un tetto al 100%. Tocca i template che
-- possono avere ratioPct>100 (intro + i 3 B rappresentativi); b_coorte_parziale resta
-- invariato (esce solo con ratio<70%). Default nel codice già allineati.
-- Supera l'intro seed-ata in v47 (che resta storica).
-- ============================================================================

UPDATE public.pricing_settings SET value = 'La salute muscolo-scheletrica della popolazione è stata rilevata con la stessa strumentazione a due momenti: all''avvio del programma ({t0N} questionari) e a dodici mesi ({t12N} questionari). Le due rilevazioni riguardano coorti in parte diverse: il confronto è quindi condotto sulle prevalenze — la quota di popolazione in ciascun livello — e non sui conteggi assoluti. La coorte ri-valutata a dodici mesi corrisponde al {ratioPct}% di quella iniziale. I dati che seguono sono aggregati e non riferibili a singoli dipendenti.' WHERE version='v2' AND key='report_t12_andamento_intro';

UPDATE public.pricing_settings SET value = '**Andamento nei dodici mesi.** Sulla coorte ri-valutata — corrispondente al {ratioPct}% di quella esaminata all''avvio, numerosità sufficiente a rendere il confronto rappresentativo — la prevalenza di Livello 1 è passata dal {t0L1pct}% al {t12L1pct}%, con una riduzione di {deltaAbs} punti percentuali. È il risultato osservato al termine del primo anno: una quota inferiore di dipendenti con dolore e impatto funzionale rispetto all''avvio.' WHERE version='v2' AND key='report_t12_andamento_b_riduzione';

UPDATE public.pricing_settings SET value = '**Andamento nei dodici mesi.** Sulla coorte ri-valutata — corrispondente al {ratioPct}% di quella esaminata all''avvio — la prevalenza di Livello 1 si è mantenuta stabile, dal {t0L1pct}% all''avvio al {t12L1pct}% a dodici mesi. Il mantenimento del quadro nell''arco dell''anno è coerente con l''obiettivo del programma, che punta a prevenire il deterioramento della salute muscolo-scheletrica nel tempo: è un esito, non un''assenza di risultato.' WHERE version='v2' AND key='report_t12_andamento_b_stabile';

UPDATE public.pricing_settings SET value = '**Andamento nei dodici mesi.** Sulla coorte ri-valutata — corrispondente al {ratioPct}% di quella esaminata all''avvio — la prevalenza di Livello 1 è aumentata, dal {t0L1pct}% al {t12L1pct}% a dodici mesi, con un incremento di {deltaAbs} punti percentuali. Il dato è riportato con trasparenza: nell''anno considerato la quota di dipendenti con dolore e impatto funzionale è cresciuta. È l''area prioritaria su cui concentrare trattamenti mirati e monitoraggio nel ciclo successivo.' WHERE version='v2' AND key='report_t12_andamento_b_aumento';
