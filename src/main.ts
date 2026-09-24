import './ui/style.css'
import { Game } from './game.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#scene')
if (canvas === null) throw new Error('找不到 #scene canvas')

new Game(canvas).start()
