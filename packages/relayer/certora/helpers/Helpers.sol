// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity ^0.8.0;

import '@mimic-fi/v3-smart-vault/contracts/interfaces/ISmartVault.sol';
import '@mimic-fi/v3-tasks/contracts/interfaces/ITask.sol';

contract Helpers {
    function balanceOf(address account) external view returns (uint256) {
        return address(account).balance;
    }

    function areValidTasks(address[] memory tasks) external view returns (bool) {
        if (tasks.length == 0) return false;

        address smartVault = ITask(tasks[0]).smartVault();

        for (uint256 i = 0; i < tasks.length; i++) {
            address taskSmartVault = ITask(tasks[i]).smartVault();
            if (taskSmartVault != smartVault) return false;

            bool hasAnyPermission = ISmartVault(smartVault).hasAnyPermission(tasks[i]);
            if (!hasAnyPermission) return false;
        }

        return true;
    }
}
