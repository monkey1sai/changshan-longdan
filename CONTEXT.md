# Changshan Longdan (常山龍膽)

A musou action game in which Zhao Yun fights the Wei army alone inside a castle. This glossary names the concepts the game rules and the presentation share.

## Battle

**Battle**:
One fight that runs from "To Battle!" (出陣) until it reaches victory or defeat.
_Avoid_: match, round, level

**Battle setup**:
The arena, the Wei soldier spawns and Zhao Yun's starting position that a battle is played on. The **castle setup** is the one the game ships with.
_Avoid_: map, scene, stage

**Difficulty** (難度):
How hard the Wei army fights in a battle: beginner (初級), normal (普通), hard (上級) or chaos (修羅). It is chosen on the title screen and kept for retries.
_Avoid_: level, mode

**Battle phase** (戰況):
How hard the Wei army presses Zhao Yun at the current KO count: opening, pressure, surge or finale. Later phases bring more soldiers into the fight and let more of them attack at once.
_Avoid_: wave, stage

**Battle event**:
Something that happened during one step of a battle and that the presentation may react to, such as a hit, a KO or a parry.
_Avoid_: signal, message, callback

**Outcome**:
Whether a battle is still ongoing, won (victory) or lost (defeat).
_Avoid_: result, end state

**Battle result**:
The summary shown when a battle is over: KOs, best combo, battle time, damage taken and rank.
_Avoid_: stats, score

**Rank**:
The S to D letter grade in the battle result.
_Avoid_: grade, score

**Presentation**:
Everything that turns battle events into sound, effects, camera motion and HUD, without changing the battle.
_Avoid_: feedback, rendering

## Combatants

**Zhao Yun** (趙雲):
The character the player controls.
_Avoid_: hero, avatar

**Wei soldier** (魏兵):
An enemy. A soldier is a spearman, a swordsman or a captain.
_Avoid_: mob, unit, minion

**KO** (斬):
A Wei soldier defeated by Zhao Yun. The KO count is the number of KOs so far in a battle.
_Avoid_: frag, death count

**KO milestone** (人斬):
Every hundredth KO in a battle, unless it ends the battle.
_Avoid_: achievement

**Half defeated** (半數潰滅):
The moment the KO count first reaches half of the soldiers the battle started with. It is not announced when a KO milestone or the end of the battle happens at the same moment.
_Avoid_: halfway

## Combat

**Normal attack** (普攻):
The N1–N6 chain of quick attacks.
_Avoid_: light attack

**Charge attack** (蓄力技):
The C1–C6 attacks. C1 starts from standing; charging after normal attack N1–N5 gives the next charge attack (N3 → C4).
_Avoid_: heavy attack, special

**Combo** (連擊):
The number of hits Zhao Yun has landed without a gap longer than the combo window and without being hurt.
_Avoid_: chain, streak

**Combo window**:
How long a combo survives after its last hit.
_Avoid_: combo timer

**Hit-stop** (命中停頓):
The brief freeze of the battle when a hit lands or Zhao Yun parries, which gives the moment its weight.
_Avoid_: freeze frame, hitlag

**Guard** (防禦):
Holding a block against attacks from in front.
_Avoid_: shield, defend

**Parry** (完美格擋):
A guard raised just before an attack lands; it takes no damage and opens a counter.
_Avoid_: perfect block, deflect

**Guard block** (格擋):
A guard that stops part of an attack's damage.
_Avoid_: chip block

**Counter** (反擊):
The attack Zhao Yun may make right after a parry.
_Avoid_: riposte

## Musou

**Musou gauge** (無雙量):
The meter that fills as Zhao Yun lands hits, guards and gets hurt.
_Avoid_: rage, special meter

**Longdan Ready** (龍膽 就緒):
The moment the musou gauge becomes full.
_Avoid_: musou available

**Musou** (無雙):
Zhao Yun's special attack, available when the musou gauge is full; it summons the azure dragon.
_Avoid_: ultimate, super

**Azure dragon** (蒼龍):
The dragon a musou summons. It circles Zhao Yun ramming nearby soldiers, then dives into the ground in front of him.
_Avoid_: summon, pet
