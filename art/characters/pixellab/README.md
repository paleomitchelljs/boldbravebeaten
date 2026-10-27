# PixelLab characters

One folder per PixelLab export. Each folder's `metadata.json` also holds its ID and the prompt it was made from. To
open one in PixelLab, go to `https://www.pixellab.ai/create-character/<id>`. To get a fresh export (as a zip in the
same layout as these folders), fetch `https://api.pixellab.ai/mcp/characters/<id>/download`. The user makes and
animates these characters in PixelLab; Claude only downloads them and wires them into the game.

Every character the user sends goes in this table, including any not yet in the game. Raptor and Tevax_Thaukori are
left out on purpose: the user means to make them again.

The Spectre's export named its animation folder after its prompt and held two east versions. In this folder the
animation is renamed `Walking`, the version `east-0d05e068` is renamed `east`, and `east-22608964` (nearly the same)
is dropped.

| Folder | `art.yaml` key | PixelLab ID | Size | Has | Still wanted |
|---|---|---|---|---|---|
| Alligator | `alligator` | 66466883-3daa-4483-95ee-579e697cd929 | 64 | idle ×8, walk ×4 dirs | attack, death (four-legged animation set: has `attack`, no death) |
| Avatar_of_Fear | `avatar` | 87521e4a-f274-4ab8-a84a-08fed819a240 | 128 | idle ×8, walk ×8 | attack, death |
| Beren | `beren` | 7cd3c25e-88e8-43dd-b20f-e003b2c418de | 64 | idle ×8, walk ×8 | attack, death |
| Cyrus | `cyrus` | 57400efc-503b-472e-8b97-3c1b38147ffa | 64 | idle ×8 | re-export (south view replaced in PixelLab 2026-10-26), walk, attack, death |
| Golem | `clay-golem`, `iron-golem`, `stone-golem` | 522fdcbf-daea-4936-ab74-a07a96189774 | 80 | idle ×8, walk ×8 | attack, death |
| Lizardfolk_Warrior | `lizardfolk-warrior` | 5a2d243e-b78f-4b46-9fa8-adbdc18edc92 | 64 | idle ×8, walk ×4 dirs (6 frames) | attack, death; a "fighting pose, head" state (80be2814-aa6b-4a37-85cb-6ac94fc9c8fa) is in PixelLab, not exported |
| Lorc | `lorc` | 5cdcb694-3e2a-4aae-ae45-ebd006e2dbf7 | 64 | idle ×8, walk ×8 | attack (bow), death |
| Skeleton | `skeleton` | 07ca48e9-30fe-4cdf-b513-b802a07fe1fd | 64 | idle ×8, walk ×8 | attack, death |
| Spectre | `spectre` | 046bf345-29ab-4e14-96a5-fcf1923f529d | 64 | idle ×8, float ×8 (9 frames; it plays standing too, `floats: true`) | attack, death |
| Spawnee | `spawnee` | d8994796-4a0b-4c54-810d-5ce541e272d6 | 64 | idle ×8, walk ×8 | attack, death |

"Death" here means a single death sprite, not a full animation, unless the user asks for one. "idle ×8" means
standing views only; none of these has an idle animation yet.
