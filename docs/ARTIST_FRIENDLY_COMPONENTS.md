# ArtCade V2 - Artist-Friendly Components

> **Stato:** principio di prodotto e architettura UI/runtime  
> **Data:** 2026-05-24  
> **Audience:** product, editor UI, Logic Board, runtime component API

---

## Principio

ArtCade non deve nascondere i numeri importanti. Deve nascondere la
complessita tecnica inutile.

Un creativo non ha bisogno di vedere `delta time`, handle Box2D, fixture,
sync ECS, callback o boilerplate Lua per costruire un gioco. Ha pero bisogno
di controllare valori che cambiano davvero il feeling del gioco:

- velocita;
- forza del salto;
- danno;
- salute;
- durata;
- cooldown;
- raggio;
- distanza;
- volume;
- frequenza di spawn.

Questi sono **numeri di design**. Devono rimanere visibili, precisi e
bilanciabili.

La regola guida:

```text
Se un parametro cambia il feeling del gioco, mostralo.
Se un parametro serve solo al motore per funzionare, nascondilo o spostalo in Advanced.
```

---

## Due Famiglie Di Controlli

### 1. Parametri Espliciti

Sono valori numerici o asset reference che l'autore deve poter bilanciare con
precisione. Non vanno sostituiti con preset opachi tipo "lento / medio /
veloce", perche l'utente deve sapere cosa sta regolando.

| Parametro | UI consigliata | Esempio |
| --- | --- | --- |
| Speed | number input + slider | `240 px/s` |
| Jump force | number input + slider | `620` |
| Cooldown | number input | `0.35 s` |
| Detection radius | number input + viewport helper | `180 px` |
| Damage | stepper / number input | `10` |
| Health | number input | `100` |
| Duration | number input | `1.5 s` |
| Volume | slider + number | `0.8` |

La UI puo offrire slider, stepper, unita e limiti ragionevoli, ma il valore
reale deve restare leggibile.

### 2. Scelte Di Comportamento

Sono opzioni qualitative che definiscono una regola, uno stile o una modalita.
Qui menu, toggle e segmented control sono piu chiari dei numeri.

| Comportamento | UI consigliata | Esempi |
| --- | --- | --- |
| Movement style | segmented control | Platformer, Top-down, Grid |
| Follow mode | select | Direct, Smooth, Delayed |
| Patrol mode | select | Loop, Ping-pong, Random |
| Collision response | select | Stop, Bounce, Pass through |
| Trigger mode | select | Once, Every time, While inside |
| Facing mode | select | Face movement, Face target, Locked |
| Destroy condition | checkbox group | After time, On collision, Off-screen |

La regola guida:

```text
Usa numeri quando l'autore sta bilanciando il gioco.
Usa scelte descrittive quando l'autore sta definendo un comportamento.
```

---

## Creative E Advanced

Ogni Runtime Component dovrebbe avere due livelli di lettura:

| Livello | Scopo |
| --- | --- |
| Creative | controlli frequenti, linguaggio di gioco, valori di design |
| Advanced | dettagli tecnici, override, diagnostica, compatibilita |

Esempio per un `PlatformerControllerComponent`:

```text
Platform Character

Movement
Speed: 240 px/s
Acceleration: 1800 px/s2
Air control: 0.65

Jump
Jump force: 620
Coyote time: 0.10 s
Jump buffer: 0.12 s

Behavior
Facing: Face movement
Ground check: Automatic
Collision: Stop on solid
```

Il pannello non deve fingere che "lento" sia piu semplice di `240 px/s`.
Deve invece organizzare i valori in una grammatica leggibile.

---

## Impatto Su Logic Board E Component API

La Logic Board deve rimanere un livello di orchestrazione:

```text
Logic Board orchestra.
Runtime Component esegue.
Core simula.
```

Quindi:

- la Logic Board sceglie **quando** accade qualcosa;
- i Runtime Component definiscono **come** il comportamento continua nel tempo;
- il core C++ gestisce timestep, fisica, ECS, rendering, memoria e sync.

| Cosa vuole l'autore | UI ArtCade | Runtime |
| --- | --- | --- |
| Il player si muove | `TopDown Character`, `Speed: 260 px/s` | `TopDownControllerComponent` |
| Un nemico insegue | `Horde Member`, `Target: Player`, `Speed: 120 px/s` | ECS + World steering |
| Un oggetto si raccoglie | `Collectible`, `Pickup radius: 24 px` | sensor/trigger + state/audio |
| Aspetta e poi parla | `Wait: 1.0 s`, `Dialogue: intro_01` | Lua time API / future coroutine flow |

Le API low-level (`setVelocity`, `applyImpulse`, coordinate, debug) restano
disponibili, ma devono vivere in una sezione **Advanced / Generic** quando
esiste un componente piu naturale.

---

## Anti-Pattern

- Preset opachi per valori di bilanciamento: "fast" senza mostrare il valore.
- Esporre dettagli engine-only in Creative: body handle, fixture id, registry,
  delta time, draw queue, raw callback names.
- Duplicare un comportamento continuo come loop Lua se puo essere un Runtime
  Component deterministico.
- Chiamare tutto "Component" in UI: distinguere sempre **Logic Component** da
  **Runtime Component / ECS Component**.
- Nascondere parametri critici dietro parole vaghe: meglio `Cooldown: 0.35 s`
  che "attack speed: medium".

---

## Checklist Per Nuovi Componenti

Quando si aggiunge un nuovo Runtime Component o una nuova API Logic Board:

1. Separare numeri di design da dettagli tecnici.
2. Definire quali campi appaiono in Creative e quali in Advanced.
3. Mostrare unita dove hanno senso (`px/s`, `s`, `%`, `hp`).
4. Usare nomi orientati al gioco, non alla struttura interna del motore.
5. Tenere i valori reali visibili anche se si aggiungono slider o helper.
6. Collegare il componente alla Logic Board tramite capability consigliate.
7. Lasciare le API low-level in Advanced / Generic.

---

## Sintesi

ArtCade deve essere un'alternativa per creativi, non un clone dei grandi engine.
La sua promessa non e "meno potenza"; e una traduzione migliore:

```text
L'utente controlla il gioco, non il motore.
```
