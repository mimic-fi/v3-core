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

pragma solidity >=0.8.0;

/**
 * @dev Relayer interface
 */
interface IRelayer {
    /**
     * @dev Emitted every time an executor is configured
     */
    event ExecutorSet(address indexed executor, bool allowed);

    /**
     * @dev Emitted every time the default collector is set
     */
    event DefaultCollectorSet(address indexed collector);

    /**
     * @dev Emitted every time a collector is set for a smart vault
     */
    event SmartVaultCollectorSet(address indexed smartVault, address indexed collector);

    /**
     * @dev Emitted every time a smart vault's task is executed
     */
    event TaskExecuted(address indexed smartVault, address indexed task, bytes data, bool success, bytes result);

    /**
     * @dev Emitted every time some native tokens are deposited for the smart vault's balance
     */
    event Deposited(address indexed smartVault, uint256 amount);

    /**
     * @dev Emitted every time some native tokens are withdrawn from the smart vault's balance
     */
    event Withdrawn(address indexed smartVault, uint256 amount);

    /**
     * @dev Tells the default collector address
     */
    function defaultCollector() external view returns (address);

    /**
     * @dev Tells whether an executor is allowed
     * @param executor Address of the executor being queried
     */
    function isExecutorAllowed(address executor) external view returns (bool);

    /**
     * @dev Tells the smart vault available balance to relay transactions
     * @param smartVault Address of the smart vault being queried
     */
    function getSmartVaultBalance(address smartVault) external view returns (uint256);

    /**
     * @dev Tells the custom collector address set for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getSmartVaultCollector(address smartVault) external view returns (address);

    /**
     * @dev Tells the collector address applicable for a smart vault
     * @param smartVault Address of the smart vault being queried
     */
    function getApplicableCollector(address smartVault) external view returns (address);

    /**
     * @dev Configures an external executor
     * @param executor Address of the executor to be set
     * @param allowed Whether the given executor should be allowed or not
     */
    function setExecutor(address executor, bool allowed) external;

    /**
     * @dev Sets the default collector
     * @param collector Address of the new default collector to be set
     */
    function setDefaultCollector(address collector) external;

    /**
     * @dev Sets a custom collector for a smart vault
     * @param smartVault Address of smart vault to set a collector for
     * @param collector Address of the collector to be set for the given smart vault
     */
    function setSmartVaultCollector(address smartVault, address collector) external;

    /**
     * @dev Deposits native tokens for a given smart vault
     * @param smartVault Address of smart vault to deposit balance for
     * @param amount Amount of native tokens to be deposited, must match msg.value
     */
    function deposit(address smartVault, uint256 amount) external payable;

    /**
     * @dev Withdraws native tokens from a given smart vault
     * @param amount Amount of native tokens to be withdrawn
     */
    function withdraw(uint256 amount) external;

    /**
     * @dev Executes a task
     * @param task Address of the task to execute
     * @param data Calldata to execute on the given task
     */
    function execute(address task, bytes calldata data) external;
}
