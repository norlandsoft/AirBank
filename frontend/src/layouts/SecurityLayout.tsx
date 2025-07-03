import React, {useEffect, useState} from 'react';
import {connect} from 'umi';

const SecurityLayout: React.FC = (props: any) => {
  return (
    <div>
      <h1>SecurityLayout</h1>
    </div>
  )
}

export default connect(({user}) => ({
  user
}))(SecurityLayout);