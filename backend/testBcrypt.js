const bcrypt = require('bcryptjs');

async function test() {
    const hash = "$2a$10$jrWAy36SqivTDCO836/pLOIKr.HYwgpAcSG2PHW8k767Q9oyZg9MW";
    const password = "111111";
    const match = await bcrypt.compare(password, hash);
    console.log("Password match:", match);
}

test();
