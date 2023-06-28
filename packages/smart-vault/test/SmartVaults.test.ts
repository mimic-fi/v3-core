import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployProxy,
  fp,
  getSigner,
  getSigners,
  instanceAt,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

describe('SmartVault', () => {
  let smartVault: Contract
  let authorizer: Contract, registry: Contract, feeController: Contract, wrappedNT: Contract
  let owner: SignerWithAddress, mimic: SignerWithAddress, feeCollector: SignerWithAddress

  before('setup signers', async () => {
    // eslint-disable-next-line prettier/prettier
    [, owner, mimic, feeCollector] = await getSigners()
  })

  before('create dependencies', async () => {
    wrappedNT = await deploy('WrappedNativeTokenMock')
    registry = await deploy('@mimic-fi/v3-registry/artifacts/contracts/Registry.sol/Registry', [mimic.address])
    feeController = await deploy('@mimic-fi/v3-fee-controller/artifacts/contracts/FeeController.sol/FeeController', [
      feeCollector.address,
      mimic.address,
    ])
  })

  beforeEach('create smart vault', async () => {
    authorizer = await deployProxy(
      '@mimic-fi/v3-authorizer/artifacts/contracts/Authorizer.sol/Authorizer',
      [],
      [[owner.address]]
    )
    smartVault = await deployProxy(
      'SmartVault',
      [registry.address, feeController.address, wrappedNT.address],
      [authorizer.address, ZERO_ADDRESS]
    )
  })

  describe('initialization', async () => {
    it('has a registry reference', async () => {
      expect(await smartVault.registry()).to.be.equal(registry.address)
    })

    it('has a fee controller reference', async () => {
      expect(await smartVault.feeController()).to.be.equal(feeController.address)
    })

    it('has a wrapped native token reference', async () => {
      expect(await smartVault.wrappedNativeToken()).to.be.equal(wrappedNT.address)
    })

    it('has an authorizer reference', async () => {
      expect(await smartVault.authorizer()).to.be.equal(authorizer.address)
    })

    it('does not have price oracle reference', async () => {
      expect(await smartVault.priceOracle()).to.be.equal(ZERO_ADDRESS)
    })

    it('cannot be initialized twice', async () => {
      await expect(smartVault.initialize(authorizer.address, ZERO_ADDRESS)).to.be.revertedWith(
        'Initializable: contract is already initialized'
      )
    })
  })

  describe('pause', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const pauseRole = smartVault.interface.getSighash('pause')
        await authorizer.connect(owner).authorize(owner.address, smartVault.address, pauseRole, [])
        smartVault = smartVault.connect(owner)
      })

      context('when the smart vault is not paused', () => {
        it('can be paused', async () => {
          const tx = await smartVault.pause()

          expect(await smartVault.isPaused()).to.be.true

          await assertEvent(tx, 'Paused')
        })
      })

      context('when the smart vault is paused', () => {
        beforeEach('pause', async () => {
          await smartVault.pause()
        })

        it('cannot be paused', async () => {
          await expect(smartVault.pause()).to.be.revertedWith('SMART_VAULT_ALREADY_PAUSED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(smartVault.pause()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('unpause', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const unpauseRole = smartVault.interface.getSighash('unpause')
        await authorizer.connect(owner).authorize(owner.address, smartVault.address, unpauseRole, [])
        smartVault = smartVault.connect(owner)
      })

      context('when the smart vault is not paused', () => {
        it('cannot be unpaused', async () => {
          await expect(smartVault.unpause()).to.be.revertedWith('SMART_VAULT_ALREADY_UNPAUSED')
        })
      })

      context('when the smart vault is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = smartVault.interface.getSighash('pause')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, pauseRole, [])
          await smartVault.connect(owner).pause()
        })

        it('can be unpaused', async () => {
          const tx = await smartVault.unpause()

          expect(await smartVault.isPaused()).to.be.false

          await assertEvent(tx, 'Unpaused')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(smartVault.unpause()).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('setPriceOracle', () => {
    let priceOracle: Contract

    beforeEach('deploy implementation', async () => {
      priceOracle = await deploy('@mimic-fi/v3-price-oracle/artifacts/contracts/PriceOracle.sol/PriceOracle')
    })

    context('when the sender is authorized', async () => {
      beforeEach('authorize sender', async () => {
        const setPriceOracleRole = smartVault.interface.getSighash('setPriceOracle')
        await authorizer.connect(owner).authorize(owner.address, smartVault.address, setPriceOracleRole, [])
        smartVault = smartVault.connect(owner)
      })

      context('when the smart vault is not paused', () => {
        it('sets the implementation', async () => {
          await smartVault.setPriceOracle(priceOracle.address)

          expect(await smartVault.priceOracle()).to.be.equal(priceOracle.address)
        })

        it('emits an event', async () => {
          const tx = await smartVault.setPriceOracle(priceOracle.address)

          await assertEvent(tx, 'PriceOracleSet', { priceOracle: priceOracle })
        })
      })

      context('when the smart vault is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = smartVault.interface.getSighash('pause')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, pauseRole, [])
          await smartVault.connect(owner).pause()
        })

        it('reverts', async () => {
          await expect(smartVault.setPriceOracle(priceOracle.address)).to.be.revertedWith('SMART_VAULT_PAUSED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(smartVault.setPriceOracle(priceOracle.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('overrideConnectorCheck', () => {
    let connector: Contract

    beforeEach('deploy connector', async () => {
      connector = await deploy('TokenMock', ['TKN'])
    })

    it('is active by default', async () => {
      expect(await smartVault.isConnectorCheckIgnored(connector.address)).to.be.false
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const overrideConnectorCheckRole = await smartVault.interface.getSighash('overrideConnectorCheck')
        await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideConnectorCheckRole, [])
        smartVault = smartVault.connect(owner)
      })

      const itCanBeIgnored = () => {
        it('can be ignored', async () => {
          const tx = await smartVault.overrideConnectorCheck(connector.address, true)

          expect(await smartVault.isConnectorCheckIgnored(connector.address)).to.be.true

          await assertEvent(tx, 'ConnectorCheckOverridden', { connector, ignored: true })
        })
      }

      const itCanBeActive = () => {
        it('can be active', async () => {
          const tx = await smartVault.overrideConnectorCheck(connector.address, false)

          expect(await smartVault.isConnectorCheckIgnored(connector.address)).to.be.false

          await assertEvent(tx, 'ConnectorCheckOverridden', { connector, ignored: false })
        })
      }

      context('when the smart vault is not paused', () => {
        context('when the check is active', () => {
          itCanBeIgnored()
          itCanBeActive()
        })

        context('when the check is ignored', () => {
          beforeEach('ignore check', async () => {
            await smartVault.overrideConnectorCheck(connector.address, true)
            expect(await smartVault.isConnectorCheckIgnored(connector.address)).to.be.true
          })

          itCanBeIgnored()
          itCanBeActive()
        })
      })

      context('when the smart vault is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = smartVault.interface.getSighash('pause')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, pauseRole, [])
          await smartVault.connect(owner).pause()
        })

        it('reverts', async () => {
          await expect(smartVault.overrideConnectorCheck(connector.address, true)).to.be.revertedWith(
            'SMART_VAULT_PAUSED'
          )
        })
      })
    })

    context('when sender is not authorized', () => {
      it('reverts', async () => {
        await expect(smartVault.overrideConnectorCheck(connector.address, true)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('execute', () => {
    const data = '0xabcd'
    let connector: Contract

    beforeEach('deploy target', async () => {
      connector = await deploy('ConnectorMock')
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const executeRole = await smartVault.interface.getSighash('execute')
        await authorizer.connect(owner).authorize(owner.address, smartVault.address, executeRole, [])
        smartVault = smartVault.connect(owner)
      })

      const itExecutesTheConnector = () => {
        context('when the execute succeeds', () => {
          let data: string

          beforeEach('encode call', async () => {
            data = connector.interface.encodeFunctionData('call')
          })

          it('executes the connector', async () => {
            const tx = await smartVault.execute(connector.address, data)

            await assertEvent(tx, 'Executed', { connector, data, result: '0x' })

            const mock = await instanceAt('ContractMock', await connector.mock())
            await assertIndirectEvent(tx, mock.interface, 'Received', { sender: smartVault.address, value: 0 })
          })
        })

        context('when the execute does not succeeds', () => {
          const data = '0xabcdef12' // random

          it('reverts', async () => {
            await expect(smartVault.execute(connector.address, data)).to.be.revertedWith('SMART_VAULT_EXECUTE_FAILED')
          })
        })
      }

      context('when the smart vault is not paused', () => {
        context('when the connector is registered', async () => {
          context('when the connector is stateless', async () => {
            const stateless = true

            beforeEach('deploy connector', async () => {
              await registry.connect(mimic).register('connector@0.0.1', connector.address, stateless)
            })

            context('when the connector is not deprecated', async () => {
              itExecutesTheConnector()
            })

            context('when the connector is deprecated', async () => {
              beforeEach('deprecate connector', async () => {
                await registry.connect(mimic).deprecate(connector.address)
              })

              it('reverts', async () => {
                await expect(smartVault.execute(connector.address, data)).to.be.revertedWith(
                  'SMART_VAULT_CON_DEPRECATED'
                )
              })
            })
          })

          context('when the connector is stateful', async () => {
            const stateless = false

            beforeEach('deploy connector', async () => {
              await registry.connect(mimic).register('connector@0.0.1', connector.address, stateless)
            })

            it('reverts', async () => {
              await expect(smartVault.execute(connector.address, data)).to.be.revertedWith(
                'SMART_VAULT_CON_NOT_STATELESS'
              )
            })
          })
        })

        context('when the connector is not registered', async () => {
          context('when the connector check is not overridden', async () => {
            it('reverts', async () => {
              await expect(smartVault.execute(connector.address, data)).to.be.revertedWith(
                'SMART_VAULT_CON_NOT_REGISTERED'
              )
            })
          })

          context('when the connector check is overridden', async () => {
            beforeEach('override connector check', async () => {
              const overrideRole = smartVault.interface.getSighash('overrideConnectorCheck')
              await authorizer.connect(owner).authorize(owner.address, smartVault.address, overrideRole, [])
              await smartVault.connect(owner).overrideConnectorCheck(connector.address, true)
            })

            itExecutesTheConnector()
          })
        })
      })

      context('when the smart vault is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = smartVault.interface.getSighash('pause')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, pauseRole, [])
          await smartVault.connect(owner).pause()
        })

        it('reverts', async () => {
          await expect(smartVault.execute(connector.address, data)).to.be.revertedWith('SMART_VAULT_PAUSED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(smartVault.execute(connector.address, data)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    const value = fp(0.01)
    let target: Contract

    beforeEach('deploy target', async () => {
      target = await deploy('ContractMock')
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const callRole = await smartVault.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, smartVault.address, callRole, [])
        smartVault = smartVault.connect(owner)
      })

      context('when the smart vault is not paused', () => {
        context('when the call succeeds', () => {
          let data: string

          beforeEach('encode call', async () => {
            data = target.interface.encodeFunctionData('call')
          })

          it('calls the target contract', async () => {
            await owner.sendTransaction({ to: smartVault.address, value })
            const previousSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
            const previousTargetBalance = await ethers.provider.getBalance(target.address)

            const tx = await smartVault.call(target.address, data, value)
            await assertEvent(tx, 'Called', { target, value, data, result: '0x' })
            await assertIndirectEvent(tx, target.interface, 'Received', { sender: smartVault, value })

            const currentSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
            expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.sub(value))

            const currentTargetBalance = await ethers.provider.getBalance(target.address)
            expect(currentTargetBalance).to.be.equal(previousTargetBalance.add(value))
          })
        })

        context('when the call does not succeeds', () => {
          const data = '0xabcdef12' // random

          it('reverts', async () => {
            await owner.sendTransaction({ to: smartVault.address, value })
            await expect(smartVault.call(target.address, data, value)).to.be.revertedWith('SMART_VAULT_CALL_FAILED')
          })
        })
      })

      context('when the smart vault is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = smartVault.interface.getSighash('pause')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, pauseRole, [])
          await smartVault.connect(owner).pause()
        })

        it('reverts', async () => {
          await expect(smartVault.call(target.address, '0x', value)).to.be.revertedWith('SMART_VAULT_PAUSED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(smartVault.call(target.address, '0x', value)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('collect', () => {
    let token: Contract
    let from: SignerWithAddress

    const amount = fp(10)

    before('deploy token', async () => {
      from = await getSigner()
      token = await deploy('TokenMock', ['USDC'])
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const collectRole = await smartVault.interface.getSighash('collect')
        await authorizer.connect(owner).authorize(owner.address, smartVault.address, collectRole, [])
        smartVault = smartVault.connect(owner)
      })

      context('when the smart vault is not paused', () => {
        context('when the smart vault has enough allowance', () => {
          beforeEach('allow tokens', async () => {
            await token.mint(from.address, amount)
            await token.connect(from).approve(smartVault.address, amount)
          })

          it('transfers the tokens to the smart vault', async () => {
            const previousHolderBalance = await token.balanceOf(from.address)
            const previousSmartVaultBalance = await token.balanceOf(smartVault.address)

            await smartVault.collect(token.address, from.address, amount)

            const currentHolderBalance = await token.balanceOf(from.address)
            expect(currentHolderBalance).to.be.equal(previousHolderBalance.sub(amount))

            const currentSmartVaultBalance = await token.balanceOf(smartVault.address)
            expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.add(amount))
          })

          it('emits an event', async () => {
            const tx = await smartVault.collect(token.address, from.address, amount)

            await assertEvent(tx, 'Collected', { token, from, amount })
          })
        })

        context('when the smart vault does not have enough allowance', () => {
          beforeEach('allow tokens', async () => {
            await token.mint(from.address, amount)
            await token.connect(from).approve(smartVault.address, amount.sub(1))
          })

          it('reverts', async () => {
            await expect(smartVault.collect(token.address, from.address, amount)).to.be.revertedWith(
              'ERC20: insufficient allowance'
            )
          })
        })
      })

      context('when the smart vault is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = smartVault.interface.getSighash('pause')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, pauseRole, [])
          await smartVault.connect(owner).pause()
        })

        it('reverts', async () => {
          await expect(smartVault.collect(token.address, from.address, amount)).to.be.revertedWith('SMART_VAULT_PAUSED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(smartVault.collect(token.address, from.address, amount)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('withdraw', () => {
    let recipient: SignerWithAddress

    const amount = fp(10)

    before('deploy token', async () => {
      recipient = await getSigner()
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const withdrawRole = await smartVault.interface.getSighash('withdraw')
        await authorizer.connect(owner).authorize(owner.address, smartVault.address, withdrawRole, [])
        smartVault = smartVault.connect(owner)
      })

      context('when the smart vault is not paused', () => {
        context('when the fee percentage was set', async () => {
          const feePct = fp(0.002)
          const expectedFees = amount.mul(feePct).div(fp(1))
          const amountAfterFees = amount.sub(expectedFees)

          beforeEach('set fee percentage', async () => {
            await feeController.connect(mimic).setMaxFeePercentage(smartVault.address, feePct)
          })

          context('when withdrawing ERC20 tokens', async () => {
            let token: Contract

            before('deploy token', async () => {
              token = await deploy('TokenMock', ['USDC'])
            })

            context('when the smart vault has enough balance', async () => {
              beforeEach('mint tokens', async () => {
                await token.mint(smartVault.address, amount)
              })

              it('transfers the tokens to the recipient', async () => {
                const previousSmartVaultBalance = await token.balanceOf(smartVault.address)
                const previousRecipientBalance = await token.balanceOf(recipient.address)
                const previousFeeCollectorBalance = await token.balanceOf(feeCollector.address)

                await smartVault.withdraw(token.address, recipient.address, amount)

                const currentSmartVaultBalance = await token.balanceOf(smartVault.address)
                expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.sub(amount))

                const currentRecipientBalance = await token.balanceOf(recipient.address)
                expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amountAfterFees))

                const currentFeeCollectorBalance = await token.balanceOf(feeCollector.address)
                expect(currentFeeCollectorBalance).to.be.equal(previousFeeCollectorBalance.add(expectedFees))
              })

              it('emits an event', async () => {
                const tx = await smartVault.withdraw(token.address, recipient.address, amount)

                await assertEvent(tx, 'Withdrawn', {
                  token,
                  amount: amountAfterFees,
                  recipient,
                  fee: expectedFees,
                })
              })
            })

            context('when the smart vault does not have enough balance', async () => {
              it('reverts', async () => {
                await expect(smartVault.withdraw(token.address, recipient.address, amount)).to.be.revertedWith(
                  'ERC20: transfer amount exceeds balance'
                )
              })
            })
          })

          context('when withdrawing native tokens', () => {
            let token: string

            beforeEach('set token address', async () => {
              token = NATIVE_TOKEN_ADDRESS
            })

            context('when the smart vault has enough balance', async () => {
              beforeEach('deposit native tokens', async () => {
                await owner.sendTransaction({ to: smartVault.address, value: amount })
              })

              it('transfers the tokens to the recipient', async () => {
                const previousSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
                const previousRecipientBalance = await ethers.provider.getBalance(recipient.address)
                const previousFeeCollectorBalance = await ethers.provider.getBalance(feeCollector.address)

                await smartVault.withdraw(token, recipient.address, amount)

                const currentSmartVaultBalance = await ethers.provider.getBalance(smartVault.address)
                expect(currentSmartVaultBalance).to.be.equal(previousSmartVaultBalance.sub(amount))

                const currentRecipientBalance = await ethers.provider.getBalance(recipient.address)
                expect(currentRecipientBalance).to.be.equal(previousRecipientBalance.add(amountAfterFees))

                const currentFeeCollectorBalance = await ethers.provider.getBalance(feeCollector.address)
                expect(currentFeeCollectorBalance).to.be.equal(previousFeeCollectorBalance.add(expectedFees))
              })

              it('emits an event', async () => {
                const tx = await smartVault.withdraw(token, recipient.address, amount)

                await assertEvent(tx, 'Withdrawn', {
                  token,
                  amount: amountAfterFees,
                  recipient,
                  fee: expectedFees,
                })
              })
            })

            context('when the smart vault does not have enough balance', async () => {
              it('reverts', async () => {
                await expect(smartVault.withdraw(token, recipient.address, amount)).to.be.revertedWith(
                  'Address: insufficient balance'
                )
              })
            })
          })
        })

        context('when the fee percentage was not set', async () => {
          it('reverts', async () => {
            await expect(smartVault.withdraw(ZERO_ADDRESS, recipient.address, amount)).to.be.revertedWith(
              'FEE_CONTROLLER_SV_NOT_SET'
            )
          })
        })
      })

      context('when the smart vault is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = smartVault.interface.getSighash('pause')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, pauseRole, [])
          await smartVault.connect(owner).pause()
        })

        it('reverts', async () => {
          await expect(smartVault.withdraw(ZERO_ADDRESS, recipient.address, 0)).to.be.revertedWith('SMART_VAULT_PAUSED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(smartVault.withdraw(ZERO_ADDRESS, recipient.address, 0)).to.be.revertedWith(
          'AUTH_SENDER_NOT_ALLOWED'
        )
      })
    })
  })

  describe('wrap', () => {
    const amount = fp(1)

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const wrapRole = await smartVault.interface.getSighash('wrap')
        await authorizer.connect(owner).authorize(owner.address, smartVault.address, wrapRole, [])
        smartVault = smartVault.connect(owner)
      })

      context('when the smart vault is not paused', () => {
        context('when the smart vault has enough wrapped native tokens', () => {
          beforeEach('fund smart vault', async () => {
            await owner.sendTransaction({ to: smartVault.address, value: amount.mul(2) })
          })

          it('wraps the requested amount', async () => {
            const previousNativeBalance = await ethers.provider.getBalance(smartVault.address)
            const previousWrappedBalance = await wrappedNT.balanceOf(smartVault.address)

            await smartVault.wrap(amount)

            const currentNativeBalance = await ethers.provider.getBalance(smartVault.address)
            expect(currentNativeBalance).to.be.equal(previousNativeBalance.sub(amount))

            const currentWrappedBalance = await wrappedNT.balanceOf(smartVault.address)
            expect(currentWrappedBalance).to.be.equal(previousWrappedBalance.add(amount))
          })

          it('emits an event', async () => {
            const tx = await smartVault.wrap(amount)
            await assertEvent(tx, 'Wrapped', { amount })
          })
        })

        context('when the smart vault does not have enough native tokens', () => {
          it('reverts', async () => {
            await expect(smartVault.wrap(amount)).to.be.revertedWith('SMART_VAULT_WRAP_NO_BALANCE')
          })
        })
      })

      context('when the smart vault is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = smartVault.interface.getSighash('pause')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, pauseRole, [])
          await smartVault.connect(owner).pause()
        })

        it('reverts', async () => {
          await expect(smartVault.wrap(amount)).to.be.revertedWith('SMART_VAULT_PAUSED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(smartVault.wrap(amount)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('unwrap', () => {
    const amount = fp(1)

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const unwrapRole = await smartVault.interface.getSighash('unwrap')
        await authorizer.connect(owner).authorize(owner.address, smartVault.address, unwrapRole, [])
        smartVault = smartVault.connect(owner)
      })

      context('when the smart vault is not paused', () => {
        context('when the smart vault has enough wrapped native tokens', () => {
          beforeEach('fund smart vault', async () => {
            await wrappedNT.connect(owner).deposit({ value: amount })
            await wrappedNT.connect(owner).transfer(smartVault.address, amount)
          })

          it('unwraps the requested amount', async () => {
            const previousNativeBalance = await ethers.provider.getBalance(smartVault.address)
            const previousWrappedBalance = await wrappedNT.balanceOf(smartVault.address)

            await smartVault.unwrap(amount)

            const currentNativeBalance = await ethers.provider.getBalance(smartVault.address)
            expect(currentNativeBalance).to.be.equal(previousNativeBalance.add(amount))

            const currentWrappedBalance = await wrappedNT.balanceOf(smartVault.address)
            expect(currentWrappedBalance).to.be.equal(previousWrappedBalance.sub(amount))
          })

          it('emits an event', async () => {
            const tx = await smartVault.unwrap(amount)
            await assertEvent(tx, 'Unwrapped', { amount })
          })
        })

        context('when the smart vault does not have enough wrapped native tokens', () => {
          it('reverts', async () => {
            await expect(smartVault.unwrap(amount)).to.be.revertedWith('WNT_NOT_ENOUGH_BALANCE')
          })
        })
      })

      context('when the smart vault is paused', () => {
        beforeEach('pause', async () => {
          const pauseRole = smartVault.interface.getSighash('pause')
          await authorizer.connect(owner).authorize(owner.address, smartVault.address, pauseRole, [])
          await smartVault.connect(owner).pause()
        })

        it('reverts', async () => {
          await expect(smartVault.unwrap(amount)).to.be.revertedWith('SMART_VAULT_PAUSED')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(smartVault.unwrap(amount)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
