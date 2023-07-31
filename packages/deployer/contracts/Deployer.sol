// SPDX-License-Identifier: GPL-3.0-or-later
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at you[r option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity ^0.8.0;

import 'solmate/src/utils/CREATE3.sol';
import '@openzeppelin/contracts/utils/Address.sol';

import '@mimic-fi/v3-authorizer/contracts/Authorizer.sol';
import '@mimic-fi/v3-price-oracle/contracts/PriceOracle.sol';
import '@mimic-fi/v3-smart-vault/contracts/SmartVault.sol';
import '@mimic-fi/v3-registry/contracts/interfaces/IRegistry.sol';

import './interfaces/IDeployer.sol';

contract Deployer is IDeployer {
    using Address for address;

    // Registry reference
    address public immutable override registry;

    /**
     * @dev Creates a new Deployer contract
     * @param _registry Address of the Mimic Registry to be referenced
     */
    constructor(address _registry) {
        registry = _registry;
    }

    /**
     * @dev Tells the deployed address for a given input
     */
    function getAddress(address sender, string memory namespace, string memory name)
        external
        view
        override
        returns (address)
    {
        return CREATE3.getDeployed(getSalt(sender, namespace, name));
    }

    /**
     * @dev Tells the salt for a given input
     */
    function getSalt(address sender, string memory namespace, string memory name)
        public
        pure
        override
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(sender, namespace, name));
    }

    /**
     * @dev Deploys a new authorizer instance
     */
    function deployAuthorizer(string memory namespace, string memory name, AuthorizerParams memory params)
        external
        override
    {
        _validateImplementation(params.impl);
        address instance = _deployClone(namespace, name, params.impl);
        Authorizer(instance).initialize(params.owners);
        emit AuthorizerDeployed(namespace, name, instance, params.impl);
    }

    /**
     * @dev Deploys a new price oracle instance
     */
    function deployPriceOracle(string memory namespace, string memory name, PriceOracleParams memory params)
        external
        override
    {
        _validateImplementation(params.impl);
        address instance = _deployClone(namespace, name, params.impl);
        PriceOracle(instance).initialize(params.authorizer, params.signer, params.pivot, _castFeedsData(params.feeds));
        emit PriceOracleDeployed(namespace, name, instance, params.impl);
    }

    /**
     * @dev Deploys a new smart vault instance
     */
    function deploySmartVault(string memory namespace, string memory name, SmartVaultParams memory params)
        external
        override
    {
        _validateImplementation(params.impl);
        address payable instance = payable(_deployClone(namespace, name, params.impl));
        SmartVault(instance).initialize(params.authorizer, params.priceOracle);
        emit SmartVaultDeployed(namespace, name, instance, params.impl);
    }

    /**
     * @dev Deploys a new task instance
     */
    function deployTask(string memory namespace, string memory name, TaskParams memory params) external override {
        if (!params.custom) _validateImplementation(params.impl);
        address instance = _deployClone(namespace, name, params.impl);
        if (params.initializeData.length > 0) instance.functionCall(params.initializeData, 'DEPLOYER_TASK_INIT_FAILED');
        emit TaskDeployed(namespace, name, instance, params.impl);
    }

    /**
     * @dev Validates if an implementation is registered, not deprecated, and considered stateful
     * @param implementation Address of the implementation to be checked
     */
    function _validateImplementation(address implementation) internal view {
        IRegistry reg = IRegistry(registry);
        if (!reg.isRegistered(implementation)) revert DeployerImplementationNotRegistered(implementation);
        if (reg.isStateless(implementation)) revert DeployerImplementationStateless(implementation);
        if (reg.isDeprecated(implementation)) revert DeployerImplementationDeprecated(implementation);
    }

    /**
     * @dev Deploys a new clone using CREATE3
     */
    function _deployClone(string memory namespace, string memory name, address implementation)
        internal
        returns (address)
    {
        if (bytes(namespace).length == 0) revert DeployerNamespaceEmpty();
        if (bytes(name).length == 0) revert DeployerNameEmpty();

        bytes memory bytecode = abi.encodePacked(
            hex'3d602d80600a3d3981f3363d3d373d3d3d363d73',
            implementation,
            hex'5af43d82803e903d91602b57fd5bf3'
        );

        bytes32 salt = getSalt(msg.sender, namespace, name);
        return CREATE3.deploy(salt, bytecode, 0);
    }

    /**
     * @dev Casts a feed data array into a price oracle's feed data array type
     */
    function _castFeedsData(FeedData[] memory feeds) private pure returns (PriceOracle.FeedData[] memory result) {
        assembly {
            result := feeds
        }
    }
}
