// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import 'solmate/src/utils/CREATE3.sol';
import '@openzeppelin/contracts/utils/Create2.sol';

import './Wallet.sol';
import './interfaces/IWalletFactory.sol';

/**
 * @title Wallet Factory
 * @dev Factory used to deploy new wallet instances
 */
contract WalletFactory is IWalletFactory {
    /**
     * @dev Tells the deployed address for a given input using CREATE3
     */
    function getAddress(address sender, string memory name) external view override returns (address) {
        return CREATE3.getDeployed(getSalt(sender, name));
    }

    /**
     * @dev Tells the deployed address for a given input using CREATE2
     */
    function getAddressCreate2(address sender, string memory name, address implementation)
        external
        view
        override
        returns (address)
    {
        bytes32 bytecodeHash = keccak256(_getBytecode(implementation));
        return Create2.computeAddress(getSalt(sender, name), bytecodeHash, address(this));
    }

    /**
     * @dev Tells the salt for a given input
     */
    function getSalt(address sender, string memory name) public pure override returns (bytes32) {
        return keccak256(abi.encodePacked(sender, name));
    }

    /**
     * @dev Deploys a new wallet instance using CREATE3
     */
    function deployWallet(string memory name, address implementation) external override {
        if (implementation == address(0)) revert WalletFactoryImplementationZero();
        address instance = _deployClone(name, implementation);
        emit WalletDeployed(name, instance, implementation);
    }

    /**
     * @dev Deploys a new wallet instance using CREATE2
     */
    function deployWalletCreate2(string memory name, address implementation) external override {
        if (implementation == address(0)) revert WalletFactoryImplementationZero();
        address instance = _deployCloneCreate2(name, implementation);
        emit WalletDeployed(name, instance, implementation);
    }

    /**
     * @dev Deploys a new clone using CREATE3
     */
    function _deployClone(string memory name, address implementation) internal returns (address) {
        if (bytes(name).length == 0) revert WalletFactoryNameEmpty();

        bytes memory bytecode = _getBytecode(implementation);
        bytes32 salt = getSalt(msg.sender, name);
        return CREATE3.deploy(salt, bytecode, 0);
    }

    /**
     * @dev Deploys a new clone using CREATE2
     */
    function _deployCloneCreate2(string memory name, address implementation) internal returns (address addr) {
        if (bytes(name).length == 0) revert WalletFactoryNameEmpty();

        bytes memory bytecode = _getBytecode(implementation);
        bytes32 salt = getSalt(msg.sender, name);
        return Create2.deploy(0, salt, bytecode);
    }

    /**
     * @dev Tells the creation code for a given implementation
     */
    function _getBytecode(address implementation) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                hex'3d602d80600a3d3981f3363d3d373d3d3d363d73',
                implementation,
                hex'5af43d82803e903d91602b57fd5bf3'
            );
    }
}
