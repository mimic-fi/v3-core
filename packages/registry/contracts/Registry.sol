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
import '@openzeppelin/contracts/access/Ownable.sol';

import './interfaces/IRegistry.sol';

/**
 * @title Registry
 * @dev Curated list of Mimic implementations
 */
contract Registry is IRegistry, Ownable {
    // List of registered implementations
    mapping (address => bool) public override isRegistered;

    // List of deprecated implementations
    mapping (address => bool) public override isDeprecated;

    /**
     * @dev Creates a new Registry contract
     * @param owner Address that will own the registry
     */
    constructor(address owner) {
        _transferOwnership(owner);
    }

    /**
     * @dev Creates and registers an implementation
     * @param name Name of the implementation
     * @param code Code of the implementation to create and register
     */
    function create(string memory name, bytes memory code) external override onlyOwner {
        address implementation = CREATE3.deploy(keccak256(abi.encode(name)), code, 0);
        _register(name, implementation);
    }

    /**
     * @dev Registers an implementation
     * @param name Name logged for the implementation
     * @param implementation Address of the implementation to be registered
     */
    function register(string memory name, address implementation) external override onlyOwner {
        _register(name, implementation);
    }

    /**
     * @dev Deprecates an implementation
     * @param implementation Address of the implementation to be deprecated
     */
    function deprecate(address implementation) external override onlyOwner {
        require(implementation != address(0), 'REGISTRY_IMPL_ADDRESS_ZERO');
        require(isRegistered[implementation], 'REGISTRY_IMPL_NOT_REGISTERED');
        require(!isDeprecated[implementation], 'REGISTRY_IMPL_ALREADY_DEPRECATED');

        isDeprecated[implementation] = true;
        emit Deprecated(implementation);
    }

    /**
     * @dev Registers an implementation
     * @param name Name of the implementation
     * @param implementation Address of the implementation to be registered
     */
    function _register(string memory name, address implementation) internal {
        require(implementation != address(0), 'REGISTRY_IMPL_ADDRESS_ZERO');
        require(!isRegistered[implementation], 'REGISTRY_IMPL_ALREADY_REGISTERED');

        isRegistered[implementation] = true;
        emit Registered(implementation, name);
    }
}
