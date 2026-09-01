/**
 * DayZ Weapon Compatibility Knowledge Base (Smart Attachments Matrix)
 * Covers Vanilla weapons, calibers, optics, muzzles, magazines, stocks, and handguards,
 * with heuristic matching for modded items (SNAFU, Mass, CPB, Mortys, etc.).
 */

export const WEAPON_PLATFORMS = {
  // ─── AK Platform (AKM, AK74, AK101, AKS74U) ───
  AK_FAMILY: {
    patterns: [/akm/i, /ak74/i, /ak101/i, /aks74u/i, /ak_101/i, /ak_74/i],
    slots: {
      optics: [
        'KobraOptic', 'PSO1Optic', 'PSO11Optic', 'KashtanOptic', 'KazhtanOptic', '1P78Optic',
        'GrozaOptic', 'M4_T3NRDSOptic'
      ],
      muzzle: [
        'EastWeaponSuppressor', 'AK_Bayonet', 'AK74_Compensator', 'AKM_Compensator'
      ],
      buttstock: [
        'AK_WoodBttstck', 'AK74_WoodBttstck', 'AK_PlasticBttstck', 'AK_FoldingBttstck'
      ],
      handguard: [
        'AK_WoodHndgrd', 'AK74_Hndgrd', 'AK_PlasticHndgrd', 'AK_RailHndgrd'
      ]
    },
    specific: {
      akm: {
        ammo: ['Ammo_762x39', 'Ammo_762x39Tracer'],
        magazines: ['Mag_AKM_30Rnd', 'Mag_AKM_Drum75Rnd', 'Mag_AKM_Palm30Rnd']
      },
      ak74: {
        ammo: ['Ammo_545x39', 'Ammo_545x39Tracer'],
        magazines: ['Mag_AK74_30Rnd', 'Mag_AK74_45Rnd', 'Mag_AK74_Drum60Rnd']
      },
      aks74u: {
        ammo: ['Ammo_545x39', 'Ammo_545x39Tracer'],
        magazines: ['Mag_AK74_30Rnd', 'Mag_AK74_45Rnd', 'Mag_AK74_Drum60Rnd']
      },
      ak101: {
        ammo: ['Ammo_556x45', 'Ammo_556x45Tracer'],
        magazines: ['Mag_AK101_30Rnd']
      }
    }
  },

  // ─── M4 / AR-15 / NATO Platform ───
  M4_FAMILY: {
    patterns: [/m4a1/i, /m16a2/i, /ar15/i, /pioneer/i, /aur_a1/i, /aur_ax/i, /aug/i, /famas/i],
    slots: {
      optics: [
        'ACOGOptic', 'ACOGOptic_6x', 'ReflexOptic', 'M68Optic', 'M4_T3NRDSOptic',
        'StarlightOptic', 'ATACROptic'
      ],
      muzzle: [
        'M4_Suppressor', 'M4_CarryHandleOptic', 'M9A1_Bayonet', 'M4_OEBttstck'
      ],
      buttstock: [
        'M4_CQBBttstck', 'M4_MPBttstck', 'M4_OEBttstck'
      ],
      handguard: [
        'M4_PlasticHndgrd', 'M4_RISHndgrd', 'M4_MPHndgrd'
      ],
      tactical: [
        'UniversalLight'
      ]
    },
    ammo: ['Ammo_556x45', 'Ammo_556x45Tracer'],
    magazines: [
      'Mag_STANAG_30Rnd', 'Mag_STANAGCoupled_60Rnd', 'Mag_STANAG_60Rnd',
      'Mag_CMAG_10Rnd', 'Mag_CMAG_20Rnd', 'Mag_CMAG_30Rnd', 'Mag_CMAG_40Rnd'
    ]
  },

  // ─── DMR / FAL / LAR Platform (7.62x51 / .308) ───
  LAR_FAMILY: {
    patterns: [/fal/i, /lar/i, /dmr/i],
    slots: {
      optics: [
        'ACOGOptic', 'ACOGOptic_6x', 'ReflexOptic', 'M68Optic', 'M4_T3NRDSOptic',
        'StarlightOptic', 'ATACROptic', 'HuntingOptic'
      ],
      muzzle: [
        'M4_Suppressor', 'StandardSuppressor'
      ],
      buttstock: [
        'Fal_OeBttstck', 'Fal_FoldingBttstck'
      ]
    },
    ammo: ['Ammo_308Win', 'Ammo_308WinTracer'],
    magazines: [
      'Mag_FAL_20Rnd', 'Mag_DMR_10Rnd', 'Mag_DMR_20Rnd'
    ]
  },

  // ─── SVD / SV-98 / VSS Platform ───
  SVD_FAMILY: {
    patterns: [/svd/i, /vss/i, /asval/i, /vikhr/i],
    slots: {
      optics: [
        'PSO1Optic', 'PSO11Optic', 'KashtanOptic', 'KazhtanOptic', '1P78Optic'
      ],
      muzzle: [
        'EastWeaponSuppressor'
      ]
    },
    specific: {
      svd: {
        ammo: ['Ammo_762x54', 'Ammo_762x54Tracer'],
        magazines: ['Mag_SVD_10Rnd']
      },
      vss: {
        ammo: ['Ammo_9x39', 'Ammo_9x39AP'],
        magazines: ['Mag_VSS_10Rnd', 'Mag_VAL_20Rnd', 'Mag_VIKHR_30Rnd']
      },
      asval: {
        ammo: ['Ammo_9x39', 'Ammo_9x39AP'],
        magazines: ['Mag_VSS_10Rnd', 'Mag_VAL_20Rnd', 'Mag_VIKHR_30Rnd']
      },
      vikhr: {
        ammo: ['Ammo_9x39', 'Ammo_9x39AP'],
        magazines: ['Mag_VSS_10Rnd', 'Mag_VAL_20Rnd', 'Mag_VIKHR_30Rnd']
      }
    }
  },

  // ─── Bolt-Action / Hunting (Mosin, Winchester, CR527, B95, Scout) ───
  SNIPER_HUNTING: {
    patterns: [/mosin/i, /winchester/i, /b95/i, /blaze/i, /cr527/i, /scout/i, /ssg82/i, /cr550/i],
    slots: {
      optics: [
        'HuntingOptic', 'PUScopeOptic'
      ],
      muzzle: [
        'Mosin_Compensator', 'Mosin_Bayonet', 'StandardSuppressor'
      ],
      buttstock: [
        'Mosin_LeatherCover'
      ]
    },
    specific: {
      mosin: {
        ammo: ['Ammo_762x54', 'Ammo_762x54Tracer'],
        optics: ['PUScopeOptic'],
        muzzle: ['Mosin_Compensator', 'Mosin_Bayonet']
      },
      winchester: {
        ammo: ['Ammo_308Win', 'Ammo_308WinTracer'],
        optics: ['HuntingOptic']
      },
      cr527: {
        ammo: ['Ammo_762x39', 'Ammo_762x39Tracer'],
        magazines: ['Mag_CZ527_5rnd'],
        optics: ['HuntingOptic']
      },
      scout: {
        ammo: ['Ammo_556x45', 'Ammo_556x45Tracer'],
        magazines: ['Mag_Scout_5Rnd'],
        optics: ['ACOGOptic', 'ReflexOptic', 'HuntingOptic', 'ATACROptic']
      },
      ssg82: {
        ammo: ['Ammo_545x39'],
        optics: []
      }
    }
  },

  // ─── Submachine Guns (MP5K, UMP45, Vityaz, Bizon, Skorpion) ───
  SMG_FAMILY: {
    patterns: [/mp5/i, /ump/i, /vityaz/i, /pp19/i, /bizon/i, /cz61/i, /skorpion/i],
    slots: {
      optics: [
        'ReflexOptic', 'M68Optic', 'M4_T3NRDSOptic', 'KobraOptic'
      ],
      muzzle: [
        'PistolSuppressor'
      ]
    },
    specific: {
      mp5: {
        ammo: ['Ammo_9x19'],
        magazines: ['Mag_MP5_15Rnd', 'Mag_MP5_30Rnd'],
        buttstock: ['MP5k_StockBttstck'],
        handguard: ['MP5_PlasticHndgrd', 'MP5_RailHndgrd'],
        optics: ['ReflexOptic', 'M68Optic', 'M4_T3NRDSOptic'],
        muzzle: ['PistolSuppressor', 'MP5_Compensator']
      },
      ump: {
        ammo: ['Ammo_45ACP'],
        magazines: ['Mag_UMP_25Rnd'],
        optics: ['ReflexOptic', 'M68Optic', 'M4_T3NRDSOptic'],
        muzzle: ['PistolSuppressor']
      },
      bizon: {
        ammo: ['Ammo_380'],
        magazines: ['Mag_PP19_64Rnd'],
        optics: ['KobraOptic', 'KashtanOptic', '1P78Optic'],
        muzzle: ['PistolSuppressor']
      },
      cz61: {
        ammo: ['Ammo_380'],
        magazines: ['Mag_CZ61_20Rnd'],
        muzzle: ['PistolSuppressor']
      }
    }
  },

  // ─── Pistols (FX45, Glock, Colt, Deagle, Longhorn, IJ70, P1, MKII) ───
  PISTOLS: {
    patterns: [/glock/i, /colt/i, /1911/i, /fx45/i, /fnx/i, /deagle/i, /magnum/i, /revolver/i, /ij70/i, /makarov/i, /cz75/i, /p1/i, /mkii/i, /longhorn/i],
    slots: {
      muzzle: [
        'PistolSuppressor'
      ],
      tactical: [
        'TLR3Light', 'UniversalLight'
      ]
    },
    specific: {
      glock: {
        ammo: ['Ammo_9x19'],
        magazines: ['Mag_Glock_15Rnd'],
        optics: ['MiniSightOptic']
      },
      fx45: {
        ammo: ['Ammo_45ACP'],
        magazines: ['Mag_FNX45_15Rnd'],
        optics: ['MiniSightOptic']
      },
      colt: {
        ammo: ['Ammo_45ACP'],
        magazines: ['Mag_1911_7Rnd']
      },
      deagle: {
        ammo: ['Ammo_357'],
        magazines: ['Mag_Deagle_9Rnd'],
        optics: ['PistolOptic']
      },
      ij70: {
        ammo: ['Ammo_380'],
        magazines: ['Mag_IJ70_8Rnd']
      },
      cz75: {
        ammo: ['Ammo_9x19'],
        magazines: ['Mag_CZ75_15Rnd']
      }
    }
  },

  // ─── Shotguns (MP133, Origin, Saiga, Double, Sawed-off) ───
  SHOTGUNS: {
    patterns: [/mp133/i, /saiga/i, /shotgun/i, /izh43/i, /bk133/i, /bk43/i],
    ammo: ['Ammo_12gaPellets', 'Ammo_12gaSlug', 'Ammo_12gaRubberSlug'],
    specific: {
      saiga: {
        magazines: ['Mag_Saiga_5Rnd', 'Mag_Saiga_8Rnd', 'Mag_Saiga_Drum20Rnd'],
        buttstock: ['Saiga_Bttstck'],
        optics: ['KobraOptic', 'KashtanOptic', '1P78Optic']
      }
    }
  }
};

/**
 * Finds all compatible attachments, optics, magazines and ammo for a given weapon classname.
 * Can filter or expand with modded items from loaded types.xml.
 * 
 * @param {string} weaponClassname e.g. 'M4A1', 'AK74', 'SVD', 'SNAFU_AK74'
 * @param {Set<string>|Array<string>} xmlItemsSet loaded items database (optional)
 * @returns {object|null} result categorized by slot
 */
export function detectCompatibleAttachments(weaponClassname, xmlItemsSet = null) {
  if (!weaponClassname || typeof weaponClassname !== 'string') return null;
  const lowerName = weaponClassname.toLowerCase();

  const xmlSet = xmlItemsSet ? (xmlItemsSet instanceof Set ? xmlItemsSet : new Set(Array.from(xmlItemsSet).map(i => i.toLowerCase()))) : null;

  let matchedFamily = null;
  let matchedSpecificKey = null;

  // 1. Identify weapon family & specific sub-type
  for (const [famKey, fam] of Object.entries(WEAPON_PLATFORMS)) {
    const isFamilyMatch = fam.patterns && fam.patterns.some(p => p.test(lowerName));
    if (isFamilyMatch) {
      matchedFamily = fam;
      if (fam.specific) {
        for (const specKey of Object.keys(fam.specific)) {
          if (lowerName.includes(specKey)) {
            matchedSpecificKey = specKey;
            break;
          }
        }
      }
      break;
    }
  }

  if (!matchedFamily) {
    return null;
  }

  // 2. Gather candidates for each slot
  const result = {
    weapon: weaponClassname,
    platform: matchedFamily,
    magazines: [],
    ammo: [],
    optics: [],
    muzzle: [],
    buttstock: [],
    handguard: [],
    tactical: []
  };

  const specificData = matchedSpecificKey && matchedFamily.specific ? matchedFamily.specific[matchedSpecificKey] : {};

  // Magazines
  const baseMags = [
    ...(specificData.magazines || []),
    ...(matchedFamily.magazines || [])
  ];
  result.magazines = [...new Set(baseMags)];

  // Ammo
  const baseAmmo = [
    ...(specificData.ammo || []),
    ...(matchedFamily.ammo || [])
  ];
  result.ammo = [...new Set(baseAmmo)];

  // Optics
  const baseOptics = [
    ...(specificData.optics !== undefined ? specificData.optics : (matchedFamily.slots?.optics || []))
  ];
  result.optics = [...new Set(baseOptics)];

  // Muzzle
  const baseMuzzle = [
    ...(specificData.muzzle !== undefined ? specificData.muzzle : (matchedFamily.slots?.muzzle || []))
  ];
  result.muzzle = [...new Set(baseMuzzle)];

  // Buttstock
  const baseButtstock = [
    ...(specificData.buttstock !== undefined ? specificData.buttstock : (matchedFamily.slots?.buttstock || []))
  ];
  result.buttstock = [...new Set(baseButtstock)];

  // Handguard
  const baseHandguard = [
    ...(specificData.handguard !== undefined ? specificData.handguard : (matchedFamily.slots?.handguard || []))
  ];
  result.handguard = [...new Set(baseHandguard)];

  // Tactical
  const baseTactical = [
    ...(specificData.tactical !== undefined ? specificData.tactical : (matchedFamily.slots?.tactical || []))
  ];
  result.tactical = [...new Set(baseTactical)];

  // 3. Dynamic Mod Matcher from xmlItems (if database is loaded)
  if (xmlSet && xmlSet.size > 0) {
    // E.g., for M4/STANAG, search loaded DB for custom STANAG magazines or mod optics
    if (lowerName.includes('m4') || lowerName.includes('m16') || lowerName.includes('ar15') || lowerName.includes('aug')) {
      for (const item of xmlSet) {
        if ((item.includes('stanag') || item.includes('cmag') || item.includes('556x45') || item.includes('pmag')) && (item.includes('mag_') || item.includes('_mag') || item.includes('drum'))) {
          // Normalize item case from raw if possible, or push
          result.magazines.push(item);
        }
      }
    }
    // E.g., for AK74
    if (lowerName.includes('ak74') || lowerName.includes('aks74')) {
      for (const item of xmlSet) {
        if ((item.includes('ak74') || item.includes('545x39')) && (item.includes('mag_') || item.includes('_mag') || item.includes('drum'))) {
          result.magazines.push(item);
        }
      }
    }
    // E.g., for AKM
    if (lowerName.includes('akm') || lowerName.includes('ak_47') || lowerName.includes('ak47')) {
      for (const item of xmlSet) {
        if ((item.includes('akm') || item.includes('762x39')) && (item.includes('mag_') || item.includes('_mag') || item.includes('drum'))) {
          result.magazines.push(item);
        }
      }
    }
    // E.g., for FAL / LAR / DMR
    if (lowerName.includes('fal') || lowerName.includes('lar') || lowerName.includes('dmr')) {
      for (const item of xmlSet) {
        if ((item.includes('fal') || item.includes('dmr') || item.includes('308win')) && (item.includes('mag_') || item.includes('_mag'))) {
          result.magazines.push(item);
        }
      }
    }
  }

  // Apply user-defined custom overrides from localStorage
  const customData = getCustomAttachmentsData();
  const weaponOverrides = customData[lowerName] || {};
  
  if (weaponOverrides.added) {
    for (const [slotKey, items] of Object.entries(weaponOverrides.added)) {
      if (Array.isArray(items) && result[slotKey]) {
        result[slotKey].push(...items);
      }
    }
  }

  if (weaponOverrides.removed) {
    for (const [slotKey, items] of Object.entries(weaponOverrides.removed)) {
      if (Array.isArray(items) && result[slotKey]) {
        const removeSet = new Set(items.map(x => x.toLowerCase()));
        result[slotKey] = result[slotKey].filter(x => !removeSet.has(x.toLowerCase()));
      }
    }
  }

  // Deduplicate and filter non-empty lists
  for (const slotKey of ['magazines', 'ammo', 'optics', 'muzzle', 'buttstock', 'handguard', 'tactical']) {
    result[slotKey] = [...new Set(result[slotKey])];
  }

  const totalAttachments = Object.keys(result).reduce((acc, k) => {
    return Array.isArray(result[k]) ? acc + result[k].length : acc;
  }, 0);

  if (totalAttachments === 0) {
    return null;
  }

  return result;
}


const CUSTOM_ATTACHMENTS_KEY = 'dayz_editor_custom_attachments';

/**
 * Gets all user-customized attachment overrides from localStorage.
 * Format: { [weaponLower]: { added: { [slotKey]: ['Mod_Optic'] }, removed: { [slotKey]: ['PSO1Optic'] } } }
 */
export function getCustomAttachmentsData() {
  try {
    const raw = localStorage.getItem(CUSTOM_ATTACHMENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Adds a custom attachment classname to a specific weapon slot.
 */
export function addCustomAttachmentToWeapon(weaponClassname, slotKey, attachmentClassname) {
  if (!weaponClassname || !slotKey || !attachmentClassname) return;
  const wLower = weaponClassname.toLowerCase();
  const data = getCustomAttachmentsData();
  if (!data[wLower]) data[wLower] = { added: {}, removed: {} };
  if (!data[wLower].added) data[wLower].added = {};
  if (!data[wLower].removed) data[wLower].removed = {};
  if (!data[wLower].added[slotKey]) data[wLower].added[slotKey] = [];
  if (!data[wLower].removed[slotKey]) data[wLower].removed[slotKey] = [];

  // Remove from removed list if previously removed
  data[wLower].removed[slotKey] = data[wLower].removed[slotKey].filter(
    x => x.toLowerCase() !== attachmentClassname.toLowerCase()
  );

  // Add to added list if not present
  if (!data[wLower].added[slotKey].some(x => x.toLowerCase() === attachmentClassname.toLowerCase())) {
    data[wLower].added[slotKey].push(attachmentClassname.trim());
  }

  try {
    localStorage.setItem(CUSTOM_ATTACHMENTS_KEY, JSON.stringify(data));
  } catch (e) {}
}

/**
 * Removes an attachment from a weapon slot.
 */
export function removeCustomAttachmentFromWeapon(weaponClassname, slotKey, attachmentClassname) {
  if (!weaponClassname || !slotKey || !attachmentClassname) return;
  const wLower = weaponClassname.toLowerCase();
  const data = getCustomAttachmentsData();
  if (!data[wLower]) data[wLower] = { added: {}, removed: {} };
  if (!data[wLower].added) data[wLower].added = {};
  if (!data[wLower].removed) data[wLower].removed = {};
  if (!data[wLower].added[slotKey]) data[wLower].added[slotKey] = [];
  if (!data[wLower].removed[slotKey]) data[wLower].removed[slotKey] = [];

  // Remove from added list if present
  data[wLower].added[slotKey] = data[wLower].added[slotKey].filter(
    x => x.toLowerCase() !== attachmentClassname.toLowerCase()
  );

  // Mark in removed list
  if (!data[wLower].removed[slotKey].some(x => x.toLowerCase() === attachmentClassname.toLowerCase())) {
    data[wLower].removed[slotKey].push(attachmentClassname.trim());
  }

  try {
    localStorage.setItem(CUSTOM_ATTACHMENTS_KEY, JSON.stringify(data));
  } catch (e) {}
}

/**
 * Resets any custom overrides for a weapon back to vanilla defaults.
 */
export function resetCustomAttachmentsForWeapon(weaponClassname) {
  if (!weaponClassname) return;
  const wLower = weaponClassname.toLowerCase();
  const data = getCustomAttachmentsData();
  delete data[wLower];
  try {
    localStorage.setItem(CUSTOM_ATTACHMENTS_KEY, JSON.stringify(data));
  } catch (e) {}
}
