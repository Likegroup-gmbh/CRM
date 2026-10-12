// CreatorList.js
// Entry-Point: Importiert Core-Klasse und alle Prototype-Mixins

import { CreatorList } from './CreatorListCore.js';
import './CreatorListView.js';
import './CreatorListBulk.js';
import './CreatorListForm.js';

export { CreatorList };
export const creatorList = new CreatorList({ mode: 'all' });
export const managementCreatorList = new CreatorList({ mode: 'management' });
