import { TASK_TEST_GET_TEST_FILES, TASK_TEST_RUN_MOCHA_TESTS } from 'hardhat/builtin-tasks/task-names'
import { HardhatNetworkConfig, HardhatRuntimeEnvironment, HttpNetworkConfig, RunSuperFunction } from 'hardhat/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

export async function overrideTestTask(
  args: any,
  hre: HardhatRuntimeEnvironment,
  run: RunSuperFunction<any>
): Promise<void> {
  const files = await hre.run(TASK_TEST_GET_TEST_FILES, { testFiles: args.testFiles })
  if (hre.network.name === 'hardhat' && args.fork) await runForkTests(args, files, hre, run)
  else await runNormalTests(args, files, hre, run)
}

async function runNormalTests(
  args: any,
  files: string[],
  hre: HardhatRuntimeEnvironment,
  run: RunSuperFunction<any>
): Promise<void> {
  console.log('Running normal tests...')
  if (args.fork) throw Error('Cannot run normal tests with a forked network')
  args.testFiles = files.filter((file: string) => file.endsWith('.test.ts'))
  if (args.testFiles.length == 0) return hre.run(TASK_TEST_RUN_MOCHA_TESTS, { testFiles: [] })

  await run(args)
}

async function runForkTests(
  args: any,
  files: string[],
  hre: HardhatRuntimeEnvironment,
  run: RunSuperFunction<any>
): Promise<void> {
  console.log(`Running fork tests on ${args.fork}...`)
  if (args.fork === 'hardhat') throw Error('Cannot fork local networks')

  args.testFiles = files.filter((file: string) => file.endsWith(`.${args.fork}.ts`) || file.endsWith(`.fork.ts`))
  if (args.testFiles.length == 0) return hre.run(TASK_TEST_RUN_MOCHA_TESTS, { testFiles: [] })

  const forkingNetworkName = Object.keys(hre.config.networks).find((networkName) => networkName === args.fork)
  if (!forkingNetworkName) throw Error(`Could not find a config for network ${args.fork} to be forked`)

  const forkingNetworkConfig = hre.config.networks[forkingNetworkName] as HttpNetworkConfig
  if (!forkingNetworkConfig.url) throw Error(`Could not find a RPC url in network config for ${forkingNetworkName}`)

  if (args.chainId) hre.config.networks.hardhat.chainId = args.chainId

  await hre.network.provider.request({
    method: 'hardhat_reset',
    params: [{ forking: { jsonRpcUrl: forkingNetworkConfig.url, blockNumber: args.blockNumber } }],
  })

  const config = hre.network.config as HardhatNetworkConfig
  config.forking = { enabled: true, blockNumber: args.blockNumber, url: forkingNetworkConfig.url, httpHeaders: {} }

  await run(args)
}

export function getForkedNetwork(hre: HardhatRuntimeEnvironment): string {
  const config = hre.network.config as HardhatNetworkConfig
  if (!config.forking || !config.forking.url) throw Error(`No forks found on network ${hre.network.name}`)

  const network = Object.entries(hre.config.networks).find(([, networkConfig]) => {
    const httpNetworkConfig = networkConfig as HttpNetworkConfig
    return httpNetworkConfig.url && httpNetworkConfig.url === config?.forking?.url
  })

  if (!network) throw Error(`No network found matching fork from ${config.forking.url}`)
  return network[0]
}
