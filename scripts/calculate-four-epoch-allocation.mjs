import { readFile } from "node:fs/promises"
import { calculateFundedRedistributionV2 } from "../lib/monthly-cycles/funded-redistribution-v2-calculator.ts"

const inputPath = process.argv[2]
if (!inputPath) throw new Error("four_epoch_calculator_input_required")
const input = JSON.parse(await readFile(inputPath, "utf8"))
const result = await calculateFundedRedistributionV2(input)
process.stdout.write(`${JSON.stringify(result)}\n`)
