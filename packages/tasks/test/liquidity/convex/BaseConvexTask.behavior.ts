import { assertEvent, deploy, ZERO_ADDRESS } from '@mimic-fi/v3-helpers'
import { expect } from 'chai'
import { Contract } from 'ethers'

export function itBehavesLikeBaseConvexTask(): void {
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
          connector = await deploy('TokenMock', ['TKN'])
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
          await expect(this.task.setConnector(connector)).to.be.revertedWith('TASK_CONNECTOR_ZERO')
        })
      })
    })

    context('when the sender is not authorized', () => {
      it('reverts', async function () {
        await expect(this.task.setConnector(ZERO_ADDRESS)).to.be.revertedWith('AUTH_SENDER_NOT_ALLOWED')
      })
    })
  })
}
