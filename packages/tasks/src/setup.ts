import { BigNumberish, deploy, deployProxy, fp, getSigner, ZERO_ADDRESS, ZERO_BYTES32 } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { Contract } from 'ethers'

export const ARTIFACTS = {
  REGISTRY: '@mimic-fi/v3-registry/artifacts/contracts/Registry.sol/Registry',
  FEE_CONTROLLER: '@mimic-fi/v3-fee-controller/artifacts/contracts/FeeController.sol/FeeController',
  AUTHORIZER: '@mimic-fi/v3-authorizer/artifacts/contracts/Authorizer.sol/Authorizer',
  PRICE_ORACLE: '@mimic-fi/v3-price-oracle/artifacts/contracts/PriceOracle.sol/PriceOracle',
  SMART_VAULT: '@mimic-fi/v3-smart-vault/artifacts/contracts/SmartVault.sol/SmartVault',
}

export type Mimic = {
  wrappedNativeToken: Contract
  registry: Contract
  feeController: Contract
  feeCollector: SignerWithAddress
  owner: SignerWithAddress
}

export async function setupMimic(feeCollector: SignerWithAddress, owner: SignerWithAddress): Promise<Mimic> {
  const wrappedNativeToken = await deploy('WrappedNativeTokenMock')
  const registry = await deploy(ARTIFACTS.REGISTRY, [owner.address])
  const feeController = await deploy(ARTIFACTS.FEE_CONTROLLER, [feeCollector.address, owner.address])

  return { wrappedNativeToken, registry, feeController, owner, feeCollector }
}

export type Environment = {
  mimic: Mimic
  authorizer: Contract
  priceOracle: Contract
  smartVault: Contract
  owner: SignerWithAddress
}

export async function deployEnvironment(owner?: SignerWithAddress, mimic?: Mimic): Promise<Environment> {
  if (!owner) owner = await getSigner(1)
  if (!mimic) mimic = await setupMimic(await getSigner(8), await getSigner(9))

  const authorizer = await deployProxy(ARTIFACTS.AUTHORIZER, [], [[owner.address]])

  const priceOracle = await deployProxy(
    ARTIFACTS.PRICE_ORACLE,
    [],
    [authorizer.address, owner.address, mimic.wrappedNativeToken.address, []]
  )

  const smartVault = await deployProxy(
    ARTIFACTS.SMART_VAULT,
    [mimic.registry.address, mimic.feeController.address, mimic.wrappedNativeToken.address],
    [authorizer.address, priceOracle.address, []]
  )

  await mimic.feeController.connect(mimic.owner).setMaxFeePercentage(smartVault.address, fp(0.02))

  return { mimic, authorizer, priceOracle, smartVault, owner }
}

export type TaskConfig = {
  baseConfig: {
    owner: string
    smartVault: string
    previousBalanceConnectorId: string
    nextBalanceConnectorId: string
  }
  gasLimitConfig: {
    gasPriceLimit: BigNumberish
    priorityFeeLimit: BigNumberish
    txCostLimit: BigNumberish
    txCostLimitPct: BigNumberish
  }
  timeLockConfig: {
    delay: BigNumberish
    nextExecutionTimestamp: BigNumberish
  }
  tokenIndexConfig: {
    acceptanceType: BigNumberish
    tokens: string[]
  }
  tokenThresholdConfig: {
    customThresholds: { token: string; min: BigNumberish; max: BigNumberish }[]
    defaultThreshold: {
      token: string
      min: BigNumberish
      max: BigNumberish
    }
  }
  volumeLimitConfig: {
    defaultLimitToken: string
    defaultLimitAmount: BigNumberish
    defaultLimitPeriod: BigNumberish
    customVolumeLimitConfigs: {
      token: string
      limitToken: string
      limitAmount: BigNumberish
      limitPeriod: BigNumberish
    }[]
  }
}

export function buildEmptyTaskConfig(owner: SignerWithAddress, smartVault: Contract): TaskConfig {
  return {
    baseConfig: {
      owner: owner.address,
      smartVault: smartVault.address,
      previousBalanceConnectorId: ZERO_BYTES32,
      nextBalanceConnectorId: ZERO_BYTES32,
    },
    gasLimitConfig: {
      gasPriceLimit: 0,
      priorityFeeLimit: 0,
      txCostLimit: 0,
      txCostLimitPct: 0,
    },
    timeLockConfig: {
      delay: 0,
      nextExecutionTimestamp: 0,
    },
    tokenIndexConfig: {
      acceptanceType: 0,
      tokens: [],
    },
    tokenThresholdConfig: {
      customThresholds: [],
      defaultThreshold: {
        token: ZERO_ADDRESS,
        min: 0,
        max: 0,
      },
    },
    volumeLimitConfig: {
      defaultLimitToken: ZERO_ADDRESS,
      defaultLimitAmount: 0,
      defaultLimitPeriod: 0,
      customVolumeLimitConfigs: [],
    },
  }
}
