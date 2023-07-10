import {
  assertEvent,
  assertIndirectEvent,
  deploy,
  deployProxy,
  fp,
  getSigners,
  ZERO_ADDRESS,
} from '@mimic-fi/v3-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { Contract } from 'ethers'

import { buildEmptyTaskConfig, deployEnvironment, Mimic } from '../../src/setup'

describe('Depositor', () => {
  let task: Contract, relayer: Contract
  let smartVault: Contract, authorizer: Contract, mimic: Mimic, owner: SignerWithAddress

  before('setup', async () => {
    // eslint-disable-next-line prettier/prettier
    ([, owner] = await getSigners())
    ;({ authorizer, smartVault, mimic } = await deployEnvironment(owner))
  })

  beforeEach('deploy relayer', async () => {
    relayer = await deploy('RelayerMock', [0])
  })

  beforeEach('deploy task', async () => {
    task = await deployProxy(
      'Depositor',
      [],
      [
        {
          recipient: relayer.address,
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        },
      ]
    )
  })

  describe('initialization', async () => {
    context('when the recipient is not zero', async () => {
      it('has a recipient reference', async () => {
        expect(await task.recipient()).to.be.equal(relayer.address)
      })

      it('cannot be initialized twice', async () => {
        const config = {
          recipient: relayer.address,
          taskConfig: buildEmptyTaskConfig(owner, smartVault),
        }
        await expect(task.initialize(config)).to.be.revertedWith('Initializable: contract is already initialized')
      })
    })

    context('when the recipient is zero', async () => {
      const config = {
        recipient: ZERO_ADDRESS,
        taskConfig: buildEmptyTaskConfig(owner, smartVault),
      }
      it('reverts', async () => {
        expect(await task.initialize(config)).to.be.revertedWith('DEPOSITOR_RECIPIENT_ZERO')
      })
    })
  })

  describe('call', () => {
    const min = fp(10)
    const max = fp(10000)

    beforeEach('authorize task', async () => {
      const callRole = smartVault.interface.getSighash('call')
      await authorizer.connect(owner).authorize(task.address, smartVault.address, callRole, [])
    })

    beforeEach('set default token threshold', async () => {
      const setDefaultTokenThresholdRole = task.interface.getSighash('setDefaultTokenThreshold')
      await authorizer.connect(owner).authorize(owner.address, task.address, setDefaultTokenThresholdRole, [])
      await task
        .connect(owner)
        .setDefaultTokenThreshold({ token: mimic.wrappedNativeToken.address, min: min, max: max })
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async () => {
        const callRole = task.interface.getSighash('call')
        await authorizer.connect(owner).authorize(owner.address, task.address, callRole, [])
        task = task.connect(owner)
      })

      context('when the threshold has passed', () => {
        const amount = fp(100)

        beforeEach('fund smart vault', async () => {
          await owner.sendTransaction({ to: smartVault.address, value: amount.mul(2) })
        })

        it('calls the call function', async () => {
          const tx = await task.call(amount)

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
          const tx = await task.call(amount)
          await assertEvent(tx, 'Executed')
        })
      })

      context('when the threshold has not passed', () => {
        const amount = min.sub(1)

        beforeEach('fund smart vault', async () => {
          await owner.sendTransaction({ to: smartVault.address, value: amount })
        })

        it('reverts', async () => {
          await expect(task.call(amount)).to.be.revertedWith('TASK_TOKEN_THRESHOLD_NOT_MET')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async () => {
        await expect(task.call(0)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
})
