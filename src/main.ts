import './ui/style.css'
import { Game } from './game.ts'
import { initInterface } from './ui/interface.ts'

initInterface()

const canvas = document.querySelector<HTMLCanvasElement>('#scene')
if (canvas === null) throw new Error('找不到 #scene canvas')

new Game(canvas).start()
