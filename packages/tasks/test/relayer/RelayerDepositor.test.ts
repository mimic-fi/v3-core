import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployProxy,
  fp,
  getSigners,
  NATIVE_TOKEN_ADDRESS,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment } from '../../src/setup'

describe('RelayerDepositor', () => {
  let task: Contract, relayer: Contract
  let smartVault: Contract, authorizer: Contract, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault } = await deployEnvironment(owner))
  })

  beforeEach('deploy relayer', async () => {
    relayer = await deploy('RelayerMock', [])
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'RelayerDepositor',
      [],
      [
        {
          relayer: relayer.address,
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
      ]
    )
  })

  describe('initialization', async () => {
    context('when the relayer is not zero', async () => {
      it('has a relayer reference', async () => {
        expect(await task.relayer()).to.be.equal(relayer.address)
      })

      it('cannot be initialized twice', async () => {
        const config = {
          relayer: relayer.address,
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        }
        await expect(task.initialize(config)).to.be.revertedWith('Initializable: contract is already initialized')
      })
    })

    context('when the relayer is zero', async () => {
      const config = {
        relayer: ZERO_ADDRESS,
        taskConfig: buildEmptyTaskConfig(owner, smartVault),
      }
      it('reverts', async () => {
        expect(await task.initialize(config)).to.be.revertedWith('TASK_RELAYER_DEPOSITOR_ZERO')
      })
    })
  })

  describe('setRelayer', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async () => {
        const setRelayerRole = task.interface.getSighash('setRelayer')
        await authorizer.connect(owner).authorize(owner.address, task.address, setRelayerRole, [])
        task = task.connect(owner)
      })

      context('when the relayer is not zero', () => {
        it('sets the relayer', async () => {
          await task.setRelayer(relayer.address)

          expect(await task.relayer()).to.be.equal(relayer.address)
        })

        it('emits an event', async () => {
          const tx = await task.setRelayer(relayer.address)

          await assertEvent(tx, 'RelayerSet', { relayer })
        })
      })

      context('when the relayer is zero', () => {
        it('reverts', async () => {
          await expect(task.setRelayer(ZERO_ADDRESS)).to.be.revertedWith('TASK_RELAYER_DEPOSITOR_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.setRelayer(relayer.address)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })

  describe('call', () => {
    beforeEach('authorize task', async () => {
      const callRole = smartVault.interface.getSighash('call')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, callRole, [])
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      const token = NATIVE_TOKEN_ADDRESS

      context('when the given amount is greater than zero', () => {
        const amount = fp(100)

        beforeEach('fund smart vault', async () => {
          await owner.sendTransaction({ to: smartVault.address, value: amount.mul(2) })
        })

        context('when the threshold has passed', () => {
          const threshold = amount

          beforeEach('set default token threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(token, threshold, 0)
          })

          it('calls the call function', async () => {
            const tx = await task.call(token, amount)

            const data = relayer.interface.encodeFunctionData('deposit', [smartVault.address, amount])
            await assertIndirectEvent(tx, smartVault.interface, 'Called', {
              target: relayer,
              value: amount,
              data,
              result: '0x',
            })

            await assertIndirectEvent(tx, relayer.interface, 'Deposited', { smartVault: smartVault.address, amount })
          })

          it('emits an Executed event', async () => {
            const tx = await task.call(token, amount)
            await assertEvent(tx, 'Executed')
          })
        })

        context('when the threshold has not passed', () => {
          const threshold = amount.add(1)

          beforeEach('set default token threshold', async () => {
            const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
            await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
            await task.connect(owner).setDefaultTokenThreshold(NATIVE_TOKEN_ADDRESS, threshold, 0)
          })

          beforeEach('fund smart vault', async () => {
            await owner.sendTransaction({ to: smartVault.address, value: amount })
          })

          it('reverts', async () => {
            await expect(task.call(token, amount)).to.be.revertedWith('TASK_TOKEN_THRESHOLD_NOT_MET')
          })
        })
      })

      context('when the given amount is zero', () => {
        const amount = 0

        it('reverts', async () => {
          await expect(task.call(token, amount)).to.be.revertedWith('TASK_AMOUNT_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(ZERO_ADDRESS, 0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
