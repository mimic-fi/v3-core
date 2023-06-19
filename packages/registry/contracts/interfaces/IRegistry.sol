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

import '@openzeppelin/contracts/access/Ownable.sol';

import './IRegistry.sol';

/**
 * @dev Registry interface
 */
interface IRegistry {
    /**
     * @dev Emitted every time an implementation is registered
     */
    event Registered(address indexed implementation, string name, bool stateless);

    /**
     * @dev Emitted every time an implementation is deprecated
     */
    event Deprecated(address indexed implementation);

    /**
     * @dev Tells whether an implementation is registered
     * @param implementation Address of the implementation being queried
     */
    function isRegistered(address implementation) external view returns (bool);

    /**
     * @dev Tells whether an implementation is stateless or not
     * @param implementation Address of the implementation being queried
     */
    function isStateless(address implementation) external view returns (bool);

    /**
     * @dev Tells whether an implementation is deprecated
     * @param implementation Address of the implementation being queried
     */
    function isDeprecated(address implementation) external view returns (bool);

    /**
     * @dev Creates and registers an implementation
     * @param name Name of the implementation
     * @param code Code of the implementation to create and register
     * @param stateless Whether the new implementation is considered stateless or not
     */
    function create(string memory name, bytes memory code, bool stateless) external;

    /**
     * @dev Registers an implementation
     * @param name Name of the implementation
     * @param implementation Address of the implementation to be registered
     * @param stateless Whether the given implementation is considered stateless or not
     */
    function register(string memory name, address implementation, bool stateless) external;

    /**
     * @dev Deprecates an implementation
     * @param implementation Address of the implementation to be deprecated
     */
    function deprecate(address implementation) external;
}
