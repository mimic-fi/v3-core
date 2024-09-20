import { assertEvent, deployTokenMock, fp, ZERO_ADDRESS } from '@mimic-fi/helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'

export function itBehavesLikeBaseCurveTask(executionType: string): void {
  describe('execution type', () => {
    it('defines it correctly', async function () {
      const expectedType = ethers.utils.solidityKeccak256(['string'], [executionType])
      expect(await this.task.EXECUTION_TYPE()).to.be.equal(expectedType)
    })
  })

  describe('setConnector', () => {
    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setConnectorRole = this.task.interface.getSighash('setConnector')
        await this.authorizer.connect(this.owner).authorize(this.owner.address, this.task.address, setConnectorRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when the new connector is not zero', () => {
        let connector: Contract

        beforeEach('deploy connector', async function () {
          connector = await deployTokenMock('TKN')
        })

        it('sets the token out', async function () {
          await this.task.setConnector(connector.address)

          expect(await this.task.connector()).to.be.equal(connector.address)
        })

        it('emits an event', async function () {
          const tx = await this.task.setConnector(connector.address)

          await assertEvent(tx, 'ConnectorSet', { connector })
        })
      })

      context('when the new connector is zero', () => {
        const connector = ZERO_ADDRESS

        it('reverts', async function () {
          await expect(this.task.setConnector(connector)).to.be.revertedWith('TaskConnectorZero')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setConnector(ZERO_ADDRESS)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setDefaultTokenOut', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await deployTokenMock('TKN')
    })

    context('when the sender is authorized', () => {
      beforeEach('authorize sender', async function () {
        const setDefaultTokenOutRole = this.task.interface.getSighash('setDefaultTokenOut')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setDefaultTokenOutRole, [])
        this.task = this.task.connect(this.owner)
      })

      it('sets the token out', async function () {
        await this.task.setDefaultTokenOut(token.address)

        expect(await this.task.defaultTokenOut()).to.be.equal(token.address)
      })

      it('emits an event', async function () {
        const tx = await this.task.setDefaultTokenOut(token.address)

        await assertEvent(tx, 'DefaultTokenOutSet', { tokenOut: token })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setDefaultTokenOut(ZERO_ADDRESS)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setCustomTokenOut', () => {
    let token: Contract, tokenOut: Contract

    beforeEach('deploy token', async function () {
      token = await deployTokenMock('IN')
      tokenOut = await deployTokenMock('OUT')
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setCustomTokenOutRole = this.task.interface.getSighash('setCustomTokenOut')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setCustomTokenOutRole, [])
        this.task = this.task.connect(this.owner)
      })

      it('sets the token out', async function () {
        await this.task.setCustomTokenOut(token.address, tokenOut.address)

        expect(await this.task.customTokenOut(token.address)).to.be.equal(tokenOut.address)
      })

      it('emits an event', async function () {
        const tx = await this.task.setCustomTokenOut(token.address, tokenOut.address)

        await assertEvent(tx, 'CustomTokenOutSet', { token, tokenOut })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setCustomTokenOut(token.address, tokenOut.address)).to.be.revertedWith(
          'AuthSenderNotAllowed'
        )
      })
    })
  })

  describe('setDefaultMaxSlippage', () => {
    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setDefaultMaxSlippageRole = this.task.interface.getSighash('setDefaultMaxSlippage')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setDefaultMaxSlippageRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async function () {
          await this.task.setDefaultMaxSlippage(slippage)

          expect(await this.task.defaultMaxSlippage()).to.be.equal(slippage)
        })

        it('emits an event', async function () {
          const tx = await this.task.setDefaultMaxSlippage(slippage)

          await assertEvent(tx, 'DefaultMaxSlippageSet', { maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async function () {
          await expect(this.task.setDefaultMaxSlippage(slippage)).to.be.revertedWith('TaskSlippageAboveOne')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setDefaultMaxSlippage(1)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })

  describe('setCustomMaxSlippage', () => {
    let token: Contract

    beforeEach('deploy token', async function () {
      token = await deployTokenMock('TKN')
    })

    context('when the sender is authorized', () => {
      beforeEach('set sender', async function () {
        const setCustomMaxSlippageRole = this.task.interface.getSighash('setCustomMaxSlippage')
        await this.authorizer
          .connect(this.owner)
          .authorize(this.owner.address, this.task.address, setCustomMaxSlippageRole, [])
        this.task = this.task.connect(this.owner)
      })

      context('when the slippage is not above one', () => {
        const slippage = fp(1)

        it('sets the slippage', async function () {
          await this.task.setCustomMaxSlippage(token.address, slippage)

          expect(await this.task.customMaxSlippage(token.address)).to.be.equal(slippage)
        })

        it('emits an event', async function () {
          const tx = await this.task.setCustomMaxSlippage(token.address, slippage)

          await assertEvent(tx, 'CustomMaxSlippageSet', { token, maxSlippage: slippage })
        })
      })

      context('when the slippage is above one', () => {
        const slippage = fp(1).add(1)

        it('reverts', async function () {
          await expect(this.task.setCustomMaxSlippage(token.address, slippage)).to.be.revertedWith(
            'TaskSlippageAboveOne'
          )
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setCustomMaxSlippage(ZERO_ADDRESS, 0)).to.be.revertedWith('AuthSenderNotAllowed')
      })
    })
  })
}
