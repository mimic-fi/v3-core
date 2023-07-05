import { assertEvent, deploy, getSigners, instanceAt } from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

const ARTIFACTS = {
  REGISTRY: '@mimic-fi/v3-registry/artifacts/contracts/Registry.sol/Registry',
  AUTHORIZER: '@mimic-fi/v3-authorizer/artifacts/contracts/Authorizer.sol/Authorizer',
  PRICE_ORACLE: '@mimic-fi/v3-price-oracle/artifacts/contracts/PriceOracle.sol/PriceOracle',
  SMART_VAULT: '@mimic-fi/v3-smart-vault/artifacts/contracts/SmartVault.sol/SmartVault',
}

describe('Deployer', () => {
  let deployer: Contract, registry: Contract
  let sender: SignerWithAddress, mimic: SignerWithAddress

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, sender, mimic] = await getSigners()
  })

  beforeEach('create deployer', async () => {
    registry = await deploy(ARTIFACTS.REGISTRY, [mimic.address])
    deployer = await deploy('Deployer', [registry.address])
  })

  describe('initialization', async () => {
    it('has a registry reference', async () => {
      await expect(await deployer.registry()).to.be.equal(registry.address)
    })
  })

  describe('deployAuthorizer', () => {
    let authorizer: Contract

    const namespace = 'project'
    const name = 'authorizer'

    beforeEach('create authorizer implementation', async () => {
      authorizer = await deploy(ARTIFACTS.AUTHORIZER, [])
    })

    context('when the implementation is registered', () => {
      beforeEach('register implementation', async () => {
        await registry.connect(mimic).register('authorizer@0.0.1', authorizer.address, false)
      })

      context('when the implementation is not deprecated', () => {
        const itDeploysAuthorizerInstance = () => {
          it('deploys the expected authorizer instance', async () => {
            const tx = await deployer.deployAuthorizer(namespace, name, {
              impl: authorizer.address,
              owners: [sender.address],
            })

            const event = await assertEvent(tx, 'AuthorizerDeployed', {
              namespace,
              name,
              implementation: authorizer.address,
            })

            const expectedAddress = await deployer.getAddress(tx.from, namespace, name)
            expect(event.args.instance).to.be.equal(expectedAddress)
          })

          it('initializes the authorizer instance correctly', async () => {
            const tx = await deployer.deployAuthorizer(namespace, name, {
              impl: authorizer.address,
              owners: [sender.address],
            })

            const instance = await instanceAt(ARTIFACTS.AUTHORIZER, await deployer.getAddress(tx.from, namespace, name))
            await expect(instance.initialize([])).to.be.revertedWith('Initializable: contract is already initialized')

            const authorizeRole = instance.interface.getSighash('authorize')
            const unauthorizeRole = instance.interface.getSighash('unauthorize')

            expect(await instance.isAuthorized(sender.address, instance.address, authorizeRole, [])).to.be.true
            expect(await instance.isAuthorized(sender.address, instance.address, unauthorizeRole, [])).to.be.true
          })
        }

        context('when the namespace and name where not used', () => {
          beforeEach('set sender', () => {
            deployer = deployer.connect(sender)
          })

          itDeploysAuthorizerInstance()
        })

        context('when the namespace and name where already used', () => {
          beforeEach('deploy authorizer', async () => {
            await deployer
              .connect(sender)
              .deployAuthorizer(namespace, name, { impl: authorizer.address, owners: [sender.address] })
          })

          context('when deploying from the same address', () => {
            beforeEach('set sender', () => {
              deployer = deployer.connect(sender)
            })

            it('reverts', async () => {
              await expect(
                deployer.deployAuthorizer(namespace, name, { impl: authorizer.address, owners: [sender.address] })
              ).to.be.revertedWith('DEPLOYMENT_FAILED')
            })
          })

          context('when deploying from another address', () => {
            beforeEach('set sender', () => {
              deployer = deployer.connect(mimic)
            })

            itDeploysAuthorizerInstance()
          })
        })
      })

      context('when the implementation is deprecated', () => {
        beforeEach('deprecate implementation', async () => {
          await registry.connect(mimic).deprecate(authorizer.address)
        })

        it('reverts', async () => {
          await expect(
            deployer.deployAuthorizer(namespace, name, { impl: authorizer.address, owners: [sender.address] })
          ).to.be.revertedWith('DEPLOYER_IMPL_DEPRECATED')
        })
      })
    })

    context('when the implementation is not registered', () => {
      it('reverts', async () => {
        await expect(
          deployer.deployAuthorizer(namespace, name, { impl: authorizer.address, owners: [sender.address] })
        ).to.be.revertedWith('DEPLOYER_IMPL_NOT_REGISTERED')
      })
    })
  })

  describe('deployPriceOracle', () => {
    let priceOracle: Contract

    const PIVOT = '0x0000000000000000000000000000000000000001'
    const SIGNER = '0x0000000000000000000000000000000000000002'
    const AUTHORIZER = '0x0000000000000000000000000000000000000003'

    const BASE_1 = '0x000000000000000000000000000000000000000a'
    const BASE_2 = '0x000000000000000000000000000000000000000b'
    const QUOTE_1 = '0x000000000000000000000000000000000000000c'
    const QUOTE_2 = '0x000000000000000000000000000000000000000d'
    const FEED_1 = '0x000000000000000000000000000000000000000E'
    const FEED_2 = '0x000000000000000000000000000000000000000F'

    const priceOracleParams = {
      authorizer: AUTHORIZER,
      pivot: PIVOT,
      signer: SIGNER,
      feeds: [
        { base: BASE_1, quote: QUOTE_1, feed: FEED_1 },
        { base: BASE_2, quote: QUOTE_2, feed: FEED_2 },
      ],
    }

    const namespace = 'project'
    const name = 'price-oracle'

    beforeEach('create price oracle implementation', async () => {
      priceOracle = await deploy(ARTIFACTS.PRICE_ORACLE)
    })

    context('when the implementation is registered', () => {
      beforeEach('register implementations', async () => {
        await registry.connect(mimic).register('price-oracle@0.0.1', priceOracle.address, false)
      })

      context('when the implementation is not deprecated', () => {
        const itDeploysPriceOracleInstance = () => {
          it('deploys the expected price oracle instance', async () => {
            const tx = await deployer.deployPriceOracle(namespace, name, {
              impl: priceOracle.address,
              ...priceOracleParams,
            })

            const event = await assertEvent(tx, 'PriceOracleDeployed', {
              namespace,
              name,
              implementation: priceOracle.address,
            })

            const expectedAddress = await deployer.getAddress(tx.from, namespace, name)
            expect(event.args.instance).to.be.equal(expectedAddress)
          })

          it('initializes the price oracle instance correctly', async () => {
            const tx = await deployer.deployPriceOracle(namespace, name, {
              impl: priceOracle.address,
              ...priceOracleParams,
            })

            const instance = await instanceAt(
              ARTIFACTS.PRICE_ORACLE,
              await deployer.getAddress(tx.from, namespace, name)
            )

            await expect(instance.initialize(AUTHORIZER, PIVOT, SIGNER, [])).to.be.revertedWith(
              'Initializable: contract is already initialized'
            )

            expect(await instance.authorizer()).to.be.equal(AUTHORIZER)
            expect(await instance.pivot()).to.be.equal(PIVOT)
            expect(await instance.isSignerAllowed(SIGNER)).to.be.true

            expect(await instance.getFeed(BASE_1, QUOTE_1)).to.be.equal(FEED_1)
            expect(await instance.getFeed(BASE_2, QUOTE_2)).to.be.equal(FEED_2)
          })
        }

        context('when the namespace and name where not used', () => {
          beforeEach('set sender', () => {
            deployer = deployer.connect(sender)
          })

          itDeploysPriceOracleInstance()
        })

        context('when the namespace and name where already used', () => {
          beforeEach('deploy price oracle', async () => {
            await deployer
              .connect(sender)
              .deployPriceOracle(namespace, name, { impl: priceOracle.address, ...priceOracleParams })
          })

          context('when deploying from the same address', () => {
            beforeEach('set sender', () => {
              deployer = deployer.connect(sender)
            })

            it('reverts', async () => {
              await expect(
                deployer.deployPriceOracle(namespace, name, { impl: priceOracle.address, ...priceOracleParams })
              ).to.be.revertedWith('DEPLOYMENT_FAILED')
            })
          })

          context('when deploying from another address', () => {
            beforeEach('set sender', () => {
              deployer = deployer.connect(mimic)
            })

            itDeploysPriceOracleInstance()
          })
        })
      })

      context('when the implementation is deprecated', () => {
        beforeEach('deprecate implementation', async () => {
          await registry.connect(mimic).deprecate(priceOracle.address)
        })

        it('reverts', async () => {
          await expect(
            deployer.deployPriceOracle(namespace, name, { impl: priceOracle.address, ...priceOracleParams })
          ).to.be.revertedWith('DEPLOYER_IMPL_DEPRECATED')
        })
      })
    })

    context('when the implementation is not registered', () => {
      it('reverts', async () => {
        await expect(
          deployer.deployPriceOracle(namespace, name, { impl: priceOracle.address, ...priceOracleParams })
        ).to.be.revertedWith('DEPLOYER_IMPL_NOT_REGISTERED')
      })
    })
  })

  describe('deploySmartVault', () => {
    let smartVault: Contract

    const FEE_CONTROLLER = '0x0000000000000000000000000000000000000001'
    const WRAPPED_NATIVE_TOKEN = '0x0000000000000000000000000000000000000002'

    const AUTHORIZER = '0x0000000000000000000000000000000000000003'
    const PRICE_ORACLE = '0x0000000000000000000000000000000000000004'

    const smartVaultParams = {
      authorizer: AUTHORIZER,
      priceOracle: PRICE_ORACLE,
    }

    const namespace = 'project'
    const name = 'smart-vault'

    beforeEach('create smart vault implementation', async () => {
      smartVault = await deploy(ARTIFACTS.SMART_VAULT, [registry.address, FEE_CONTROLLER, WRAPPED_NATIVE_TOKEN])
    })

    context('when the implementation is registered', () => {
      beforeEach('register implementations', async () => {
        await registry.connect(mimic).register('smart-vault@0.0.1', smartVault.address, false)
        await registry.connect(mimic).register('price-oracle@0.0.1', PRICE_ORACLE, true)
      })

      context('when the implementation is not deprecated', () => {
        const itDeploysSmartVaultInstance = () => {
          it('deploys the expected smart vault instance', async () => {
            const tx = await deployer.deploySmartVault(namespace, name, {
              impl: smartVault.address,
              ...smartVaultParams,
            })

            const event = await assertEvent(tx, 'SmartVaultDeployed', {
              namespace,
              name,
              implementation: smartVault.address,
            })

            const expectedAddress = await deployer.getAddress(tx.from, namespace, name)
            expect(event.args.instance).to.be.equal(expectedAddress)
          })

          it('initializes the smart vault instance correctly', async () => {
            const tx = await deployer.deploySmartVault(namespace, name, {
              impl: smartVault.address,
              ...smartVaultParams,
            })

            const instance = await instanceAt(
              ARTIFACTS.SMART_VAULT,
              await deployer.getAddress(tx.from, namespace, name)
            )

            await expect(instance.initialize(AUTHORIZER, PRICE_ORACLE, [])).to.be.revertedWith(
              'Initializable: contract is already initialized'
            )

            expect(await instance.registry()).to.be.equal(registry.address)
            expect(await instance.feeController()).to.be.equal(FEE_CONTROLLER)
            expect(await instance.wrappedNativeToken()).to.be.equal(WRAPPED_NATIVE_TOKEN)

            expect(await instance.authorizer()).to.be.equal(AUTHORIZER)
            expect(await instance.priceOracle()).to.be.equal(PRICE_ORACLE)
          })
        }

        context('when the namespace and name where not used', () => {
          beforeEach('set sender', () => {
            deployer = deployer.connect(sender)
          })

          itDeploysSmartVaultInstance()
        })

        context('when the namespace and name where already used', () => {
          beforeEach('deploy smart vault', async () => {
            await deployer
              .connect(sender)
              .deploySmartVault(namespace, name, { impl: smartVault.address, ...smartVaultParams })
          })

          context('when deploying from the same address', () => {
            beforeEach('set sender', () => {
              deployer = deployer.connect(sender)
            })

            it('reverts', async () => {
              await expect(
                deployer.deploySmartVault(namespace, name, { impl: smartVault.address, ...smartVaultParams })
              ).to.be.revertedWith('DEPLOYMENT_FAILED')
            })
          })

          context('when deploying from another address', () => {
            beforeEach('set sender', () => {
              deployer = deployer.connect(mimic)
            })

            itDeploysSmartVaultInstance()
          })
        })
      })

      context('when the implementation is deprecated', () => {
        beforeEach('deprecate implementation', async () => {
          await registry.connect(mimic).deprecate(smartVault.address)
        })

        it('reverts', async () => {
          await expect(
            deployer.deploySmartVault(namespace, name, { impl: smartVault.address, ...smartVaultParams })
          ).to.be.revertedWith('DEPLOYER_IMPL_DEPRECATED')
        })
      })
    })

    context('when the implementation is not registered', () => {
      it('reverts', async () => {
        await expect(
          deployer.deploySmartVault(namespace, name, { impl: smartVault.address, ...smartVaultParams })
        ).to.be.revertedWith('DEPLOYER_IMPL_NOT_REGISTERED')
      })
    })
  })

  describe('deployTask', () => {
    let task: Contract, smartVault: Contract, initializeData: string

    const AUTHORIZER = '0x0000000000000000000000000000000000000001'

    const namespace = 'project'
    const name = 'task-mock'

    beforeEach('deploy smart vault instance', async () => {
      const FEE_CONTROLLER = '0x0000000000000000000000000000000000000001'
      const WNT = '0x0000000000000000000000000000000000000002'
      const smartVaultImpl = await deploy(ARTIFACTS.SMART_VAULT, [registry.address, FEE_CONTROLLER, WNT])
      await registry.connect(mimic).register('smart-vault@0.0.1', smartVaultImpl.address, false)

      const PRICE_ORACLE = '0x0000000000000000000000000000000000000004'
      await registry.connect(mimic).register('price-oracle@0.0.1', PRICE_ORACLE, true)

      const tx = await deployer.deploySmartVault(namespace, 'smart-vault', {
        impl: smartVaultImpl.address,
        authorizer: AUTHORIZER,
        priceOracle: PRICE_ORACLE,
        priceFeedParams: [],
      })

      smartVault = await instanceAt(ARTIFACTS.SMART_VAULT, await deployer.getAddress(tx.from, namespace, 'smart-vault'))
    })

    beforeEach('create task implementation', async () => {
      task = await deploy('TaskMock', [])
      initializeData = task.interface.encodeFunctionData('initialize', [
        { groupId: 0, smartVault: smartVault.address, tokensSource: smartVault.address },
      ])
    })

    context('when the implementation is registered', () => {
      beforeEach('register implementations', async () => {
        await registry.connect(mimic).register('task-mock@0.0.1', task.address, false)
      })

      context('when the implementation is not deprecated', () => {
        beforeEach('set sender', () => {
          deployer = deployer.connect(sender)
        })

        const itDeploysTaskInstance = () => {
          it('deploys the expected smart vault instance', async () => {
            const tx = await deployer.deployTask(namespace, name, { impl: task.address, initializeData })
            const event = await assertEvent(tx, 'TaskDeployed', { namespace, name, implementation: task.address })

            const expectedAddress = await deployer.getAddress(tx.from, namespace, name)
            expect(event.args.instance).to.be.equal(expectedAddress)
          })

          it('initializes the smart vault instance correctly', async () => {
            const tx = await deployer.deployTask(namespace, name, { impl: task.address, initializeData })

            const instance = await instanceAt('TaskMock', await deployer.getAddress(tx.from, namespace, name))
            await expect(
              instance.initialize({ groupId: 0, smartVault: smartVault.address, tokensSource: smartVault.address })
            ).to.be.revertedWith('Initializable: contract is already initialized')

            expect(await instance.authorizer()).to.be.equal(AUTHORIZER)
            expect(await instance.smartVault()).to.be.equal(smartVault.address)
          })
        }

        context('when the namespace and name where not used', () => {
          beforeEach('set sender', () => {
            deployer = deployer.connect(sender)
          })

          itDeploysTaskInstance()
        })

        context('when the namespace and name where already used', () => {
          beforeEach('deploy smart vault', async () => {
            await deployer.deployTask(namespace, name, { impl: task.address, initializeData })
          })

          context('when deploying from the same address', () => {
            beforeEach('set sender', () => {
              deployer = deployer.connect(sender)
            })

            it('reverts', async () => {
              await expect(
                deployer.deployTask(namespace, name, { impl: task.address, initializeData })
              ).to.be.revertedWith('DEPLOYMENT_FAILED')
            })
          })

          context('when deploying from another address', () => {
            beforeEach('set sender', () => {
              deployer = deployer.connect(mimic)
            })

            itDeploysTaskInstance()
          })
        })
      })

      context('when the implementation is deprecated', () => {
        beforeEach('deprecate implementation', async () => {
          await registry.connect(mimic).deprecate(task.address)
        })

        it('reverts', async () => {
          await expect(deployer.deployTask(namespace, name, { impl: task.address, initializeData })).to.be.revertedWith(
            'DEPLOYER_IMPL_DEPRECATED'
          )
        })
      })
    })

    context('when the implementation is not registered', () => {
      it('reverts', async () => {
        await expect(deployer.deployTask(namespace, name, { impl: task.address, initializeData })).to.be.revertedWith(
          'DEPLOYER_IMPL_NOT_REGISTERED'
        )
      })
    })
  })
})
