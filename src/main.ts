import './ui/style.css'
import { Game } from './game.ts'
import { initInterface } from './ui/interface.ts'
import { createAssetPack } from './assets/default-pack.ts'

initInterface()

const canvas = document.querySelector<HTMLCanvasElement>('#scene')
if (canvas === null) throw new Error('找不到 #scene canvas')

// Choose the art pack here. Gameplay does not know model paths or bone names.
new Game(canvas, createAssetPack()).start()
