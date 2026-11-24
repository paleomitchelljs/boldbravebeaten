# Burazese Continental Design

Draft layout for the game map of Burazese (W1), the Western Jungle Continent.
Compressed game scale: ~15 min walking between distant cities.

---

## Zone Graph

### Existing zones (connections added)

| Zone ID | Tileset | Lvl | New connections |
|---|---|---|---|
| `village` | outside_village | 1 | +W→savanna_west |
| `mine_approach` | cinder_hills | 2 | +N→caldera_rim |
| `temple_approach` | outside_swamp | 2 | (unchanged) |
| `south_hills` | south_hills | 2 | (unchanged) |
| `jungle_west` | jungle | 2 | Z dead-end→real stair to `mire_deep` |
| tarn/orc/sarnak/ember/temple dungeons | (various) | 2–6 | (unchanged) |
| `stonebridge` (town) | — | — | (unchanged) |

### New outdoor zones

| Zone ID | Description | Tileset | Lvl | Connects to |
|---|---|---|---|---|
| `savanna_west` | Grassland W of village | grassland | 2 | E↔village, N↔central_jungle, S↔burbuma_frontier |
| `central_jungle` | Dense jungle, central Burazese | jungle | 2 | S↔savanna_west, N↔muawi_road |
| `muawi_road` | Jungle road toward Muawi | jungle | 3 | S↔central_jungle, N↔muawi_lakes |
| `muawi_lakes` | Lake district around Muawi | lakeland | 3 | S↔muawi_road, N↔hegemony_road, E↔iaza_crossroads. City: **muawi_city** |
| `hegemony_road` | Road through Muzhumewe Hegemony | jungle | 4 | S↔muawi_lakes, N↔hegemony_jungle |
| `hegemony_jungle` | Hegemony heartland | jungle | 5 | S↔hegemony_road. City: **zhomelonga_city** |
| `iaza_crossroads` | Grassland–jungle border crossroads | grassland | 3 | W↔muawi_lakes, E↔caldera_road, S↔naalda_river |
| `caldera_road` | Ash road toward Exeomo | cinder_hills | 4 | W↔iaza_crossroads, E↔caldera_rim |
| `caldera_rim` | Exeomo caldera rim | cinder_hills | 5 | W↔caldera_road, S↔mine_approach, N↔caldera_basin |
| `caldera_basin` | Inside the caldera (high-level) | cinder_hills | 6 | S↔caldera_rim |
| `naalda_river` | River crossing on the Naalda | grassland | 3 | N↔iaza_crossroads, S↔barjiy_road, E↔eastern_lakes |
| `barjiy_road` | Road toward Barjiy | grassland | 3 | N↔naalda_river, S↔barjiy_outskirts |
| `barjiy_outskirts` | Approaches to Barjiy | grassland | 4 | N↔barjiy_road. City: **barjiy_city** |
| `eastern_lakes` | Great lakes (Eyenome) | lakeland | 4 | W↔naalda_river, N↔eseumbu_marsh |
| `eseumbu_marsh` | Swampy lakeside, Eseumbu | jungle | 4 | S↔eastern_lakes |
| `burbuma_frontier` | Burbuma border region | grassland | 3 | N↔savanna_west, S↔siege_belt. City: **burbuma_city** |
| `siege_belt` | Contested Oubouuwu zone | grassland | 4 | N↔burbuma_frontier, S↔muulau_lowlands |
| `muulau_lowlands` | Southern lowlands | grassland | 4 | N↔siege_belt, S↔emagshir_south |
| `emagshir_south` | Southern tip, arid | desert | 5 | N↔muulau_lowlands. City: **emagshir_city** |
| `mire_deep` | Deep jungle-swamp W of Mire Wood | jungle | 3 | E↔jungle_west |

### New city towns

| Town ID | Name | People | Pop | Exits to |
|---|---|---|---|---|
| `muawi_city` | Muawea | Lizardfolk | 15k | muawi_lakes |
| `zhomelonga_city` | Zhomelonga | Lizardfolk | 108k | hegemony_jungle |
| `barjiy_city` | Isdi (Barjiy) | Human | 24k | barjiy_outskirts |
| `burbuma_city` | Iitanii (Burbuma) | Lizardfolk-ruled, mixed | 33k | burbuma_frontier |
| `emagshir_city` | Emagshir | Human (tributary) | ~5k | emagshir_south |

---

## Existing Dungeon Placement

| Dungeon complex | Continental location | Accessed from |
|---|---|---|
| **Ember complex** (ember_hall → ember_lair) | Inside Exeomo caldera | mine_approach (Black Hills at caldera foot) |
| **Temple complex** (temple_court → temple_palace_stair) | Lizardfolk ruins in jungle E of village | temple_approach (swamp approach) |
| **Orc complex** (orc_valley, orc_castle, orc_mines) | Highland mountains S of Tarnhold | south_hills → tarnhold chain |
| **Sarnak fort** | Tarn highlands, old Lizardfolk border fort | tarn_plains chain |
| **Mill cellars** | Under Stonebridge | stonebridge (town) |

---

## City Faction Nexuses

Each city has two nexuses: **law-abiding** (surface politics) and **underworld** (shadow politics).

### Stonebridge (existing, Human frontier town)

**Law-abiding:**
- **Stonebridge Watch** (existing: `town_watch`) — the garrison; loyal to the distant Barjiy crown but practically autonomous
- **Merchants' Guild** (existing: `merchants_guild`) — traders linking Stonebridge to the wider continent
- **Lantern Order** (existing: `lantern_order`) — temple scholars, keepers of old knowledge; politically moderate
- **Common Folk** — tradesfolk, farmers, smiths; want stability and protection from monsters

**Underworld:**
- **Cutthroats** (existing: `cutthroats`) — local gang, smuggling and protection rackets
- **Grave Cult** (existing: `grave_cult`) — necromantic cells operating in the mill cellars
- **Smugglers' Ring** — contraband flowing through the frontier, exploiting weak oversight
- **Barjiy Spies** — agents of the Barjiy crown keeping tabs on this remote settlement

### Muawea / Muawi (Lizardfolk city-state, orthodox theocracy)

**Law-abiding:**
- **Temple of Muawea** — the orthodox Saurian rite; punishes heresy; dominant political force
- **House of Murenyange** — the ruling dynasty (sovereign Yojayombe); missionary expansionists
- **Muawi Iron-Traders** — merchant caravans trading with Muzhumutwa and Muzhumewe; primary source of wealth
- **Lizard Wardens** — city guard; devout and exclusive, distrustful of outsiders

**Underworld:**
- **Froglok Resistance** — the 2% Froglok minority chafing under orthodoxy
- **Human Smugglers** — Human merchants running contraband through the jungle
- **Heretic Cultists** — secret practitioners of banned rites
- **Emagrip Agents** — spies for the distant Emagrip Empire (Muawi is tributary)

### Zhomelonga (Muzhumewe Hegemony capital, Lizardfolk, pop 108k)

**Law-abiding:**
- **Hegemony Court** — sovereign Lahalelo (House of Nggawomsa); the most powerful state on Burazese
- **Orthodox Priesthood** — single-rite theocrats; punish heresy and foreign religions
- **Hegemony Guard** — elite military; 171 wars launched, 41 cities sacked
- **Trade Guilds** — steel, glass, true dye; Zhomelonga imports 27k food-value units/yr
- **River Clans** — the communal bulk of the population; long-horizon farmers and fishers

**Underworld:**
- **Elven Quarter** — 34% Elven minority in Zhomelonga; tolerated but excluded from power
- **Ishiumunga Spies** — agents of the Froglok state currently at war with the Hegemony
- **Dissident Clans** — ethnic revolt cells (three breakaways in the last decade alone)
- **Smugglers' Docks** — contraband flowing via the Muloenyo river network

### Isdi / Barjiy (Human principality capital, pop 24k)

**Law-abiding:**
- **House of Ilisi** — sovereign Enmoglo; martial honour culture, holy-war expansionists
- **Temple of the Sun** — Human orthodox rite; drives missionary policy
- **Barjiy Guard** — soldiers of a state that has launched 24 wars; aggressive and proud
- **Iron Merchants** — Barjiy holds one of only 13 iron deposits; major export

**Underworld:**
- **Lizardfolk Ghetto** — 19% Lizardfolk minority in Isdi, ruled over by Humans
- **Secessionists** — 7 secession revolts in 258 years; breakaway factions active
- **Hegemony Agents** — Barjiy is tributary to Muzhumewe; Lizardfolk spies ensure compliance
- **Mountain Bandits** — raiding from the highland ruins (Karjavar, Beitjavar)

### Iitanii / Burbuma (Lizardfolk-ruled, mixed population, pop 33k)

**Law-abiding:**
- **House of Barerimu** — sovereign Chejnguisi; martial honour, exclusive, orthodox
- **Burbuma War-Council** — 13 wars launched; "the sword is the first instrument of policy"
- **Orthodox Temple** — Saurian rite; enforced on the Human majority
- **Naalda Merchants** — trading along the Naalda "Blood-River"; cotton fibre monopoly

**Underworld:**
- **Human Majority** — 68% Human population ruled by 28% Lizardfolk elite; tensions high
- **Burbusjare Sympathizers** — the breakaway state's agents agitating for reunification
- **Froglok Marsh-Bands** — 4% Froglok population with links to the Froglok marsh-kingdoms
- **Contraband Runners** — cotton and iron smuggling across the frontier

### Emagshir (Human city-state, tributary of Muzhumewe)

**Law-abiding:**
- **City Council** — small tributary city-state; fought holy wars but lost to Muzhumewe (sacked 9815–9825)
- **Desert Temple** — Human rite in the arid southern tip of the continent
- **Border Guard** — defending the desert frontier against raiders
- **Caravan Traders** — links to Barjiy and the Uvue coast

**Underworld:**
- **Muzhumewe Overseers** — the Hegemony's enforcers in this tributary state
- **Free Emagshir Movement** — agitators for independence from Lizardfolk overlordship
- **Desert Raiders** — nomadic bands preying on caravans
- **Smuggler Camps** — avoiding Hegemony tariffs through desert routes

---

## Geography Notes

### Central jungle (central_jungle, muawi_road, hegemony_road, hegemony_jungle)
Humid jungle rim of Burazese. 37% of the continent's area. Home of the Muzhumewe Hegemony (92% jungle terrain) and its satellite states. Dense canopy, rivers (Muloenyo, Mulozhushe), volcanic hills. The Hegemony heartland has 20 named rivers and 9 volcanoes.

### Grassland / savanna (savanna_west, burbuma_frontier, siege_belt, muulau_lowlands, naalda_river, barjiy_road, barjiy_outskirts)
51% of Burazese. Dry central plateau surrounded by the jungle rim. The Naalda "Blood-River" runs through the southern grasslands. Burbuma (96% grassland) sits in the flat riverlands. The Oubouuwu siege belt (123 documented sieges) marks the contested frontier zone.

### Lake district (muawi_lakes, eastern_lakes, eseumbu_marsh)
Burazese has four great lakes: Eyenome (295k km²), Eyenuma (130k km²), Iyenovo (126k km²), Eseumbu (37k km²). The eastern lakes zone represents the Eyenome shore. Eseumbu marsh is swampy lakeside transitioning to jungle.

### Exeomo caldera (caldera_road, caldera_rim, caldera_basin, mine_approach)
Hotspot caldera at 5.8°S, 76.2°W. 70×55 km, 0.5–1.4 km rim height. Unclaimed territory. The existing mine_approach (Black Hills, cinder_hills tileset) represents the caldera foot. New zones extend into the rim and basin.

### Desert south (emagshir_south)
Only 2% of Burazese is desert, at the southern tip. Emagshir sits here — a minor Human city-state, historically sacked by Muzhumewe.

### Temperate forest / highlands (barjiy area, south_hills chain)
10% of the continent. Barjiy Principality (53% temperate forest, 24% grassland, 23% jungle) sits in the southern highlands with mountain passes (hill road Enariy). The existing south_hills/tarnhold chain occupies the highland border.

### Deep jungle-swamp (mire_deep, eseumbu_marsh)
Jungle transitioning to marsh. Home of Frogloks (marsh-folk) and the lizardfolk ruins. The existing jungle_west (Mire Wood) is the edge; mire_deep goes further in.

---

## Zone Connection Graph (ASCII)

```
                    hegemony_jungle ← zhomelonga_city
                         |
                    hegemony_road
                         |
       muawi_city → muawi_lakes -------- iaza_crossroads ---- caldera_road ---- caldera_rim --- caldera_basin
                         |                     |                                     |
                    muawi_road            naalda_river ---- eastern_lakes       mine_approach
                         |                     |                  |                  |
                   central_jungle         barjiy_road        eseumbu_marsh       village
                         |                     |                                 / | \
  mire_deep --- jungle_west   savanna_west  barjiy_outskirts              temple  S  stonebridge
                               |      |     ← barjiy_city               approach  |
                               |   burbuma_frontier                            south_hills
                               |   ← burbuma_city                                |
                               |      |                                       tarnhold
                               |   siege_belt                                    |
                               |      |                                       (tarn chain)
                               |   muulau_lowlands                               |
                               |      |                                       (orc/sarnak)
                               |   emagshir_south
                                   ← emagshir_city
```

(Arrows ← mark where a city town connects to its outdoor zone.)
