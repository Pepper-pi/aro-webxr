# 27 November 2026

Preview only: `/v7-preview/smallmagic/` on the PR 2 branch. Live `/v7/` was not changed. Trees were not rebuilt or moved. The Mage stays staffless. Summoner holds the staff. Summoner and Puppetmaster stay separate.

## Block 48

On High, Maren, Bram, Sable, and Lumen use the bundled AvatarSample High files (A, B, and C). Those maps are 2048, not the 384 faces in the older companion files. Nothing is scaled down on High, color maps stay sRGB, and anisotropy stays high. There is no 4096 re-export in the repo, and none was added. Low still uses the bundled Phone samples at 512. The Long Lake bench sits a little higher so the seat and legs clear the flowers, and its lantern is a brass cage with amber glass instead of a white blob. A headless pass of the meadow, Long Lake, the canal, the sky deck, and the home hub still raises no page errors.

## Block 49

`@pixiv/three-vrm` 3.6.0 and `@pixiv/three-vrm-animation` 3.6.0 are both MIT (pixiv). Home Hub companions load the bundled AvatarSample High and Phone `.vrm` files through `VRMLoaderPlugin`, so `vrm.springBoneManager`, `vrm.expressionManager`, and `vrm.lookAt` stay live. Those files carry the VRM 0.0 extension. Sable and Lumen use AvatarSample C. Their twin-tail springs were exported with gravity at 0, so the tails sat out sideways. The hair joints now take a strong downward gravity and a light stiffness, then settle before the first frame, with a little wind after that.

Four clips, and only these four, play as idle, talk, greet, and nod. Each file was checked byte for byte against Sanami's open-vrma dataset (https://huggingface.co/datasets/Sanami/open-vrma). The source motion is Quaternius Universal Animation Library, CC0. Nothing from Mixamo, nothing from CMU, nothing unlicensed:

- `public/hearth/motion/Idle_Loop.vrma` is `quaternius/ual1/Idle_Loop.vrma`, 51020 bytes.
- `public/hearth/motion/Idle_Talking_Loop.vrma` is `quaternius/ual1/Idle_Talking_Loop.vrma`, 56660 bytes.
- `public/hearth/motion/Interact.vrma` is `quaternius/ual1/Interact.vrma`, 44532 bytes.
- `public/hearth/motion/Yes.vrma` is `quaternius/ual2/Yes.vrma`, 51012 bytes.

Near the player they look over, blink, smile, and play the greet. Now and then they look toward the closest companion and gesture. High stays on the 2048 maps. Low stays on the 512 maps. A headless pass of the meadow, Long Lake, the canal, the sky deck, and the home hub still raises no page errors.
